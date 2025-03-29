import React from 'react'
import { useNavigate } from 'react-router-dom'
import {v4 as uuid} from "uuid"
const Homepage = () => {
    const navigate = useNavigate()
    const randid = uuid()
  return (
    <>
    <div>Homepage</div>
    <button onClick={()=>{navigate(`/join/${randid}`)}}>
        Join Now
    </button>
    </>
  )
}

export default Homepage