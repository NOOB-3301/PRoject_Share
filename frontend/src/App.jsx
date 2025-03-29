import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import {Routes, Route } from 'react-router-dom'
import Homepage from './Components/Homepage'
import Joinedpage from './Components/Joinedpage'
function App() {


  return (
    <>
      <Routes>
        <Route path='/' element={<Homepage/>}  ></Route>
        <Route path='/join/:randid' element={<Joinedpage/>} ></Route>

      </Routes>
    </>
  )
}

export default App
