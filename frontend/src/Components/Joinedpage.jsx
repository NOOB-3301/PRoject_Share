import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { io } from "socket.io-client";

const Joinedpage = () => {
    const { randid } = useParams()

    const pc_config = {
        iceServers: [
            {
                urls: "stun:stun.l.google.com:19302",
            },
        ],
    };

    const peerconn = new RTCPeerConnection(pc_config)

    
    useEffect(() => {
        const socket = io("http://localhost:3000/");

        const createOffer = () => {
            console.log("create offer");
            peerconn
                .createOffer({offerToReceiveAudio: true, offerToReceiveVideo: true})
                .then(sdp => {
                    peerconn.setLocalDescription(sdp);
                    socket.emit("offer", sdp);
                })
                .catch(error => {
                    console.log(error);
                });
        };  

        const createAnswer = (sdp) => {
            peerconn.setRemoteDescription(sdp).then(() => {
                console.log("answer set remote description success");
                peerconn
                    .createAnswer({
                        offerToReceiveVideo: true,
                        offerToReceiveAudio: true,
                    })
                    .then(sdp1 => {
                        console.log("create answer");
                        peerconn.setLocalDescription(sdp1);
                        socket.emit("answer", sdp1);
                    })
                    .catch(error => {
                        console.log(error);
                    });
            });
        };

        // client-side
        socket.on("connect", () => {
            console.log(socket.id); // x8WIv7-mJelg7on_ALbx
            socket.emit("join",{
                room: randid, // Send the room ID
                name: "Guest"  // You can replace this with an actual username
            })
    
        });

        socket.on("room_users", (data) => {
            console.log(data);
            createOffer()
        });

            // Listen for the list of users in the room
        socket.on("event", (event) => {
            console.log("the events", event);
        });

        socket.on("disconnect", () => {
            console.log(socket.id); // undefined
        });

        socket.on("getOffer", (sdp) => {
            console.log("get offer:" + sdp);
            createAnswer(sdp);
        });

        socket.on("getAnswer", (sdp) => {
            console.log("get answer:" + sdp);
            peerconn.setRemoteDescription(sdp);
        });

        peerconn.onicecandidate = e => {
            if (e.candidate) {
                console.log("onicecandidate");
                socket.emit("candidate", e.candidate);
            }
        };
        peerconn.oniceconnectionstatechange = e => {
            console.log(e);
        };

        socket.on("getCandidate", (candidate) => {
            peerconn.addIceCandidate(new RTCIceCandidate(candidate)).then(() => {
                console.log("candidate add success");
            });
        });
    }, [randid])

    return (
        <>
            <div>Joinedpage</div>
            <div>the id is {randid}</div>
        </>
    )
}

export default Joinedpage