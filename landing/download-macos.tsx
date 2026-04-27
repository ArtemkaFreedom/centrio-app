'use client'
import { useEffect } from 'react'

export default function DownloadMacosPage() {
  useEffect(() => { window.location.replace('/download') }, [])
  return (
    <div style={{ minHeight: '100vh', background: '#070711', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'sans-serif', fontSize: 15 }}>
      Переходим...
    </div>
  )
}
