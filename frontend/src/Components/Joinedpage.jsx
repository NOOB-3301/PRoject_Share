import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from "socket.io-client";

const CHUNK_SIZE = 262144; // 256KB chunks
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

const Joinedpage = () => {
    const { randid } = useParams();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [sendProgress, setSendProgress] = useState(0);
    const [receiveProgress, setReceiveProgress] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const [transferStatus, setTransferStatus] = useState('');
    
    const dataChannelRef = useRef(null);
    const fileChunksRef = useRef([]);
    const receivedSizeRef = useRef(0);
    const fileNameRef = useRef('');
    const fileSizeRef = useRef(0);
    const peerConnRef = useRef(null);
    const sendBufferRef = useRef([]);
    const sendingRef = useRef(false);

    const sendNextChunk = async () => {
        if (!sendBufferRef.current.length || !dataChannelRef.current) {
            sendingRef.current = false;
            return;
        }

        if (dataChannelRef.current.bufferedAmount > CHUNK_SIZE * 8) {
            setTimeout(sendNextChunk, 100);
            return;
        }

        const chunk = sendBufferRef.current.shift();
        try {
            dataChannelRef.current.send(chunk);
            const progress = Math.min(100, Math.round(((fileSizeRef.current - (sendBufferRef.current.length * CHUNK_SIZE)) / fileSizeRef.current) * 100));
            setSendProgress(progress);
            
            if (sendBufferRef.current.length > 0) {
                setTimeout(sendNextChunk, 0);
            } else {
                sendingRef.current = false;
                setTransferStatus('Send complete!');
                setTimeout(() => setTransferStatus(''), 3000);
            }
        } catch (err) {
            console.error('Error sending chunk:', err);
            setError('Failed to send chunk');
            sendingRef.current = false;
        }
    };

    useEffect(() => {
        const socket = io("http://localhost:3000/");
        
        const pc_config = {
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302",
                },
                {
                    urls: 'turn:numb.viagenie.ca',
                    credential: 'muazkh',
                    username: 'webrtc@live.com'
                },
            ],
        };

        peerConnRef.current = new RTCPeerConnection(pc_config);
        const peerconn = peerConnRef.current;

        const setupDataChannel = () => {
            const dataChannel = peerconn.createDataChannel("fileTransfer", {
                ordered: true,
                maxRetransmits: 30
            });
            dataChannelRef.current = dataChannel;

            dataChannel.onopen = () => {
                console.log("Data channel opened!");
                setIsConnected(true);
            };

            dataChannel.onclose = () => {
                console.log("Data channel closed!");
                setIsConnected(false);
            };

            setupDataChannelHandlers(dataChannel);
        };

        peerconn.ondatachannel = (event) => {
            console.log("Received data channel");
            const dataChannel = event.channel;
            dataChannelRef.current = dataChannel;
            setupDataChannelHandlers(dataChannel);
            
            dataChannel.onopen = () => {
                console.log("Data channel opened!");
                setIsConnected(true);
            };
        };

        const setupDataChannelHandlers = (dataChannel) => {
            let currentFileChunks = [];
            let currentFileName = '';
            let currentFileSize = 0;
            let receivedSize = 0;

            dataChannel.binaryType = 'arraybuffer'; // Explicitly set binary type
            
            dataChannel.onmessage = async (event) => {
                try {
                    if (typeof event.data === 'string') {
                        const metadata = JSON.parse(event.data);
                        if (metadata.type === 'metadata') {
                            // Reset state for new file
                            currentFileChunks = [];
                            receivedSize = 0;
                            currentFileName = metadata.name;
                            currentFileSize = metadata.size;
                            fileChunksRef.current = currentFileChunks;
                            fileNameRef.current = currentFileName;
                            fileSizeRef.current = currentFileSize;
                            setTransferStatus('Receiving file...');
                            setReceiveProgress(0);
                            console.log('Starting to receive file:', currentFileName, 'size:', currentFileSize);
                            return;
                        }
                    }

                    // Handle binary chunk
                    const chunk = event.data;
                    currentFileChunks.push(chunk);
                    receivedSize += chunk.byteLength;
                    
                    const progress = Math.min(100, Math.round((receivedSize / currentFileSize) * 100));
                    setReceiveProgress(progress);
                    console.log('Received chunk, progress:', progress + '%');

                    if (receivedSize === currentFileSize) {
                        console.log('File transfer complete, processing...');
                        setTransferStatus('Processing file...');
                        
                        try {
                            // Create blob from chunks
                            const blob = new Blob(currentFileChunks);
                            console.log('Created blob:', blob.size, 'bytes');
                            
                            // Trigger download
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = currentFileName;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);

                            // Reset state
                            currentFileChunks = [];
                            receivedSize = 0;
                            setReceiveProgress(0);
                            setTransferStatus('Download complete!');
                            console.log('File downloaded successfully');
                            
                            setTimeout(() => {
                                setTransferStatus('');
                            }, 3000);
                        } catch (err) {
                            console.error('Error processing received file:', err);
                            setError('Error processing file: ' + err.message);
                            setTransferStatus('');
                        }
                    }
                } catch (err) {
                    console.error('Error in data channel message handler:', err);
                    setError('Error receiving file: ' + err.message);
                    setTransferStatus('');
                }
            };

            dataChannel.onerror = (error) => {
                console.error('Data channel error:', error);
                setError('Connection error: ' + error.message);
                setTransferStatus('');
            };
        };

        const createOffer = async () => {
            try {
                console.log("Creating offer...");
                setupDataChannel();
                const offer = await peerconn.createOffer();
                await peerconn.setLocalDescription(offer);
                socket.emit("offer", offer);
            } catch (error) {
                console.error("Error creating offer:", error);
            }
        };

        const createAnswer = async (offer) => {
            try {
                console.log("Creating answer...");
                await peerconn.setRemoteDescription(offer);
                const answer = await peerconn.createAnswer();
                await peerconn.setLocalDescription(answer);
                socket.emit("answer", answer);
            } catch (error) {
                console.error("Error creating answer:", error);
            }
        };

        socket.on("connect", () => {
            console.log("Socket connected:", socket.id);
            socket.emit("join", {
                room: randid,
                name: "Guest"
            });
        });

        socket.on("room_join_error", (error) => {
            setError(error.message);
            setTimeout(() => {
                navigate('/');
            }, 3000);
        });

        socket.on("room_users", (users) => {
            console.log("Room users:", users);
            if (users.length === 2 && users[0].id === socket.id) {
                createOffer();
            }
        });

        socket.on("getOffer", (offer) => {
            console.log("Received offer");
            createAnswer(offer);
        });

        socket.on("getAnswer", async (answer) => {
            console.log("Received answer");
            try {
                if (peerconn.signalingState === "have-local-offer") {
                    await peerconn.setRemoteDescription(answer);
                }
            } catch (error) {
                console.error("Error setting remote description:", error);
            }
        });

        peerconn.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("candidate", event.candidate);
            }
        };

        socket.on("getCandidate", async (candidate) => {
            try {
                await peerconn.addIceCandidate(new RTCIceCandidate(candidate));
                console.log("Added ICE candidate");
            } catch (error) {
                console.error("Error adding ICE candidate:", error);
            }
        });

        return () => {
            if (dataChannelRef.current) {
                dataChannelRef.current.close();
            }
            if (peerConnRef.current) {
                peerConnRef.current.close();
            }
            socket.disconnect();
        };
    }, [randid, navigate]);

    const sendFile = async () => {
        if (!selectedFile || !dataChannelRef.current || !isConnected) {
            alert('Please wait for peer connection or select a file');
            return;
        }

        if (sendingRef.current) {
            alert('Already sending a file');
            return;
        }

        try {
            setTransferStatus('Preparing file...');
            console.log('Starting to send file:', selectedFile.name);
            
            const arrayBuffer = await selectedFile.arrayBuffer();
            console.log('File loaded into buffer, size:', arrayBuffer.byteLength);
            
            // Send metadata first
            const metadata = {
                type: 'metadata',
                name: selectedFile.name,
                size: arrayBuffer.byteLength // Use actual buffer size
            };
            dataChannelRef.current.send(JSON.stringify(metadata));
            console.log('Sent metadata:', metadata);

            // Prepare chunks
            sendBufferRef.current = [];
            let offset = 0;
            while (offset < arrayBuffer.byteLength) {
                const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
                sendBufferRef.current.push(chunk);
                offset += CHUNK_SIZE;
            }

            console.log('File split into', sendBufferRef.current.length, 'chunks');
            
            // Start sending
            fileSizeRef.current = arrayBuffer.byteLength;
            sendingRef.current = true;
            setTransferStatus('Sending file...');
            sendNextChunk();

        } catch (err) {
            console.error('Error sending file:', err);
            setError('Failed to send file: ' + err.message);
            sendingRef.current = false;
            setTransferStatus('');
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE) {
                setError('File size exceeds 5GB limit');
                e.target.value = null;
                return;
            }
            setSelectedFile(file);
            setSendProgress(0);
            setError('');
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>File Sharing Room</h2>
            <div>Room ID: {randid}</div>
            {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
            {transferStatus && (
                <div style={{ color: 'blue', marginTop: '10px' }}>{transferStatus}</div>
            )}

            <div style={{ marginTop: '20px' }}>
                <div>Connection Status: {isConnected ? 'Connected to Peer' : 'Waiting for peer...'}</div>
                
                <div style={{ marginTop: '20px' }}>
                    <label>Select a file to send (up to 5GB):<br/>
                        <input 
                            type="file" 
                            onChange={handleFileChange} 
                            disabled={!isConnected}
                        />
                    </label>
                </div>

                {selectedFile && (
                    <div style={{ marginTop: '10px' }}>
                        <p>Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024 / 1024)}MB)</p>
                        <button 
                            onClick={sendFile}
                            disabled={!isConnected || sendingRef.current}
                            style={{ marginTop: '10px' }}
                        >
                            Send File
                        </button>
                    </div>
                )}

                {sendProgress > 0 && (
                    <div style={{ marginTop: '10px' }}>
                        <p>Send Progress: {sendProgress}%</p>
                        <div style={{ 
                            width: '100%', 
                            height: '20px', 
                            backgroundColor: '#eee',
                            borderRadius: '10px'
                        }}>
                            <div style={{
                                width: `${sendProgress}%`,
                                height: '100%',
                                backgroundColor: '#4CAF50',
                                borderRadius: '10px',
                                transition: 'width 0.3s ease-in-out'
                            }}/>
                        </div>
                    </div>
                )}

                {receiveProgress > 0 && (
                    <div style={{ marginTop: '10px' }}>
                        <p>Receiving File... {receiveProgress}%</p>
                        <div style={{ 
                            width: '100%', 
                            height: '20px', 
                            backgroundColor: '#eee',
                            borderRadius: '10px'
                        }}>
                            <div style={{
                                width: `${receiveProgress}%`,
                                height: '100%',
                                backgroundColor: '#2196F3',
                                borderRadius: '10px',
                                transition: 'width 0.3s ease-in-out'
                            }}/>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Joinedpage;
