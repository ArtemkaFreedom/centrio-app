'use client'

import { useState, useEffect, useRef, useCallback, type ReactElement } from 'react'
import Link from 'next/link'
import { useLang, LANGS, LANG_LABELS, type Lang } from '@/lib/i18n'

const VERSION = '1.6.76'
const WIN_DOWNLOAD = `https://download.centrio.me/Centrio%20Setup%20${VERSION}.exe`

const MessengerSvgs: Record<string, ReactElement> = {
  discord: <svg viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>,
  vk: <svg viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.169.508.271.508.22 0 .407-.136.813-.542 1.253-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/></svg>,
  slack: <svg viewBox="0 0 24 24" fill="white" width="26" height="26"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>,
  instagram: <svg viewBox="0 0 24 24" fill="white" width="26" height="26"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
  viber: <svg viewBox="0 0 24 24" fill="white" width="26" height="26"><path d="M11.4 0C6.64.02 2.12 2.35 1.1 7.28c-.47 2.27-.41 4.76.11 7 .88 3.77 4.23 6.63 7.98 7.38.69.14 1.4.22 2.1.22H11c.48 0 .97-.03 1.45-.08l2.93 2.93c.1.1.22.14.36.14.27 0 .5-.22.5-.5v-3.48c2.7-1.17 4.66-3.52 5.28-6.3.54-2.42.38-5.15-.2-7.3C20.04 2.67 16.36-.02 11.4 0z"/></svg>,
  signal: <svg viewBox="0 0 24 24" fill="white" width="26" height="26"><path d="M11.999 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm.643 3.13a8.845 8.845 0 0 1 5.238 2.222l-1.09 1.09a7.32 7.32 0 0 0-4.148-1.77V3.13zm-1.285 0v1.542a7.32 7.32 0 0 0-4.149 1.77L6.12 5.353a8.845 8.845 0 0 1 5.237-2.222zm6.614 2.908a8.845 8.845 0 0 1 2.222 5.237h-1.542a7.32 7.32 0 0 0-1.77-4.148l1.09-1.089zm-13.943.001l1.09 1.09a7.32 7.32 0 0 0-1.77 4.147H1.807a8.845 8.845 0 0 1 2.221-5.237zm14.614 6.604c-.088 2.028-.9 3.87-2.188 5.27l-1.088-1.088a7.33 7.33 0 0 0 1.734-4.182h1.542zm-15.685 0h1.542a7.33 7.33 0 0 0 1.734 4.182l-1.089 1.089a8.845 8.845 0 0 1-2.187-5.271zm13.315 6.456a8.845 8.845 0 0 1-5.27 2.188v-1.542a7.33 7.33 0 0 0 4.182-1.734l1.088 1.088zm-11.706-.001l1.088-1.088a7.33 7.33 0 0 0 4.182 1.734v1.542a8.845 8.845 0 0 1-5.27-2.188z"/></svg>,
  notion: <svg viewBox="0 0 24 24" fill="white" width="24" height="24"><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.047.934-.56.934-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.746.327-.746.934zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933z"/></svg>,
  trello: <svg viewBox="0 0 24 24" fill="white" width="26" height="26"><path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.656 1.343 3 3 3h18c1.656 0 3-1.344 3-3V3c0-1.657-1.344-3-3-3zM10.44 18.18c0 .795-.645 1.44-1.44 1.44H4.56c-.795 0-1.44-.645-1.44-1.44V4.56c0-.795.645-1.44 1.44-1.44H9c.795 0 1.44.645 1.44 1.44v13.62zm10.44-7.2c0 .795-.645 1.44-1.44 1.44H15c-.795 0-1.44-.645-1.44-1.44V4.56c0-.795.645-1.44 1.44-1.44h4.44c.795 0 1.44.645 1.44 1.44v6.42z"/></svg>,
  telegram_web: <svg viewBox="0 0 24 24" fill="white" width="26" height="26"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.04 9.607c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.903.614z"/></svg>,
}

const OsIcons = {
  windows: (<svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>),
  macos: (<svg viewBox="0 0 24 24" fill="currentColor" width="34" height="34"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>),
  linux: (<svg viewBox="0 0 24 24" fill="currentColor" width="34" height="34"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.09-2.127 2.11-2.716 3.904-.37 1.117-.239 2.228.296 3.325.165.37.37.741.65 1.096.3.39.506.565.66.77.3.42.546.97.972 1.38.466.45 1.062.705 1.743.916a5.56 5.56 0 0 0 1.536.238c.49.01 1.02-.058 1.554-.219.535-.16 1.059-.44 1.49-.866.434-.428.735-1.001.884-1.698.15-.7.12-1.494-.062-2.294-.182-.8-.506-1.62-.94-2.425-.435-.807-.97-1.6-1.545-2.38-.574-.78-1.186-1.545-1.732-2.34-.547-.8-1.035-1.633-1.35-2.522-.314-.89-.462-1.83-.38-2.784l.022-.291c.075-1.008.2-1.97.47-2.866.27-.895.685-1.732 1.397-2.48.713-.747 1.75-1.38 3.14-1.636l.032-.006c.277-.05.566-.077.858-.077z"/></svg>),
}

function FeatureIcon({ name }: { name: string }) {
  const s = { viewBox: '0 0 24 24', fill: 'none', stroke: 'url(#iconGrad)', strokeWidth: '1.8', width: '22', height: '22' } as const
  if (name === 'grid') return <svg {...s}><defs><linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
  if (name === 'bell') return <svg {...s}><defs><linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
  if (name === 'folder') return <svg {...s}><defs><linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
  if (name === 'globe') return <svg {...s}><defs><linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  if (name === 'theme') return <svg {...s}><defs><linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
  if (name === 'lock') return <svg {...s}><defs><linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  if (name === 'cloud') return <svg {...s}><defs><linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  if (name === 'sound') return <svg {...s}><defs><linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
  if (name === 'update') return <svg {...s}><defs><linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
  return null
}

function useScrollReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view') })
    }, { threshold: 0.12 })
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

function useAnimatedCounter(target: number, duration = 1400) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        const steps = Math.ceil(duration / 16)
        let i = 0
        const timer = setInterval(() => {
          i++
          setVal(Math.round(target * (i / steps)))
          if (i >= steps) { setVal(target); clearInterval(timer) }
        }, 16)
      }
    })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target, duration])
  return { val, ref }
}

function SupportModal({ t, onClose }: { t: any; onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault(); setSending(true)
    await new Promise(r => setTimeout(r, 800)); setSent(true); setSending(false)
  }
  const inp: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, padding: '12px 16px', color: '#f8fafc', fontSize: 14, outline: 'none',
    transition: 'border-color .2s',
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }} />
      <div style={{ position: 'relative', zIndex: 1, background: 'rgba(10,13,28,0.98)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 24, padding: '40px 36px', width: '100%', maxWidth: 460, boxShadow: '0 32px 100px rgba(0,0,0,0.9), 0 0 60px rgba(139,92,246,0.1)' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>×</button>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>
            <p style={{ color: '#f8fafc', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{t.sup_sent}</p>
            <button onClick={onClose} style={{ marginTop: 20, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 32px', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>{t.sup_close}</button>
          </div>
        ) : (
          <form onSubmit={handleSend}>
            <h3 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 800, marginBottom: 28, letterSpacing: '-.02em' }}>{t.sup_title}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input style={inp} placeholder={t.sup_name} value={name} onChange={e => setName(e.target.value)} required />
              <input style={inp} type="email" placeholder={t.sup_email} value={email} onChange={e => setEmail(e.target.value)} required />
              <textarea style={{ ...inp, resize: 'vertical', minHeight: 110 }} placeholder={t.sup_msg} value={msg} onChange={e => setMsg(e.target.value)} required />
            </div>
            <button type="submit" disabled={sending} style={{ marginTop: 22, width: '100%', background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: sending ? 0.7 : 1, transition: 'all .2s' }}>
              {sending ? '...' : t.sup_send}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function LangSwitcher({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '7px 13px', color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .2s' }}>
        {LANG_LABELS[lang]}<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'rgba(8,10,22,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, overflow: 'hidden', zIndex: 50, minWidth: 130, boxShadow: '0 16px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.1)' }}>
          {LANGS.map(l => (
            <button key={l} onClick={() => { setLang(l); setOpen(false) }} style={{ display: 'block', width: '100%', padding: '10px 18px', background: l === lang ? 'rgba(139,92,246,0.12)' : 'transparent', border: 'none', color: l === lang ? '#a78bfa' : 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: l === lang ? 700 : 400, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LandingPage() {
  const { lang, t, setLang } = useLang()
  const [scrolled, setScrolled] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })

  useScrollReveal()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const c1 = useAnimatedCounter(15)
  const c2 = useAnimatedCounter(50000)
  const c3 = useAnimatedCounter(4)

  const messengers = [
    { name: 'Telegram', img: '/messengers/telegram.png', color: '#2AABEE' },
    { name: 'WhatsApp', img: '/messengers/whatsapp.png', color: '#25D366' },
    { name: 'Discord', svg: 'discord', color: '#5865F2' },
    { name: 'ВКонтакте', svg: 'vk', color: '#0077FF' },
    { name: 'Gmail', img: '/messengers/gmail.png', color: '#EA4335' },
    { name: 'Яндекс.Почта', img: '/messengers/yandex.png', color: '#FC3F1D' },
    { name: 'Slack', svg: 'slack', color: '#4A154B' },
    { name: 'Instagram', svg: 'instagram', color: '#C13584' },
    { name: 'Viber', svg: 'viber', color: '#7360F2' },
    { name: 'Signal', svg: 'signal', color: '#3A76F0' },
    { name: 'Битрикс24', img: '/messengers/bitrix.png', color: '#2fc7f7' },
    { name: 'MAX', img: '/messengers/max.png', color: '#0087FF' },
    { name: 'Notion', svg: 'notion', color: '#333' },
    { name: 'Trello', svg: 'trello', color: '#0079BF' },
    { name: 'Telegram Web', svg: 'telegram_web', color: '#2AABEE' },
  ]

  const features = [
    { icon: 'grid', title: t.f1t, desc: t.f1d },
    { icon: 'bell', title: t.f2t, desc: t.f2d },
    { icon: 'folder', title: t.f3t, desc: t.f3d },
    { icon: 'globe', title: t.f4t, desc: t.f4d },
    { icon: 'theme', title: t.f5t, desc: t.f5d },
    { icon: 'lock', title: t.f6t, desc: t.f6d },
    { icon: 'cloud', title: t.f7t, desc: t.f7d },
    { icon: 'sound', title: t.f8t, desc: t.f8d },
    { icon: 'update', title: t.f9t, desc: t.f9d },
  ]

  return (
    <>
      <style>{`
        :root { color-scheme: dark; }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #030712; color: #e2e8f0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; overflow-x: hidden; }

        /* ── Aurora animations ─────────────────────────────────────────────── */
        @keyframes aurora1 { 0%,100%{transform:translate(0,0) scale(1);opacity:.55} 33%{transform:translate(-80px,-60px) scale(1.15);opacity:.75} 66%{transform:translate(40px,30px) scale(0.9);opacity:.5} }
        @keyframes aurora2 { 0%,100%{transform:translate(0,0) scale(1);opacity:.4} 40%{transform:translate(100px,-40px) scale(1.2);opacity:.6} 70%{transform:translate(-50px,60px) scale(0.85);opacity:.45} }
        @keyframes aurora3 { 0%,100%{transform:translate(0,0) scale(1);opacity:.35} 50%{transform:translate(-60px,80px) scale(1.1);opacity:.55} }

        /* ── Floating ──────────────────────────────────────────────────────── */
        @keyframes float { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-18px) rotate(.8deg)} }
        @keyframes float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }

        /* ── Shimmer text ──────────────────────────────────────────────────── */
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }

        /* ── Pulse ring ────────────────────────────────────────────────────── */
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(2.4);opacity:0} }

        /* ── Marquee ───────────────────────────────────────────────────────── */
        @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }

        /* ── Scroll reveal ─────────────────────────────────────────────────── */
        @keyframes reveal-up { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
        .reveal { opacity:0; transform:translateY(32px); }
        .reveal.in-view { animation:reveal-up .7s cubic-bezier(.22,1,.36,1) both; }
        .reveal.delay-1 { animation-delay:.1s; }
        .reveal.delay-2 { animation-delay:.2s; }
        .reveal.delay-3 { animation-delay:.3s; }
        .reveal.delay-4 { animation-delay:.4s; }
        .reveal.delay-5 { animation-delay:.5s; }

        /* ── Gradient text ─────────────────────────────────────────────────── */
        .gradient-text {
          background: linear-gradient(135deg, #a78bfa 0%, #60a5fa 45%, #22d3ee 100%);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: shimmer 4s linear infinite;
        }

        /* ── Buttons ───────────────────────────────────────────────────────── */
        .btn-primary {
          display:inline-flex; align-items:center; gap:10px;
          background: linear-gradient(135deg, #7c3aed, #3b82f6);
          color:#fff; font-weight:700; font-size:15px; padding:14px 30px;
          border-radius:14px; border:none; cursor:pointer; text-decoration:none;
          transition:all .25s; box-shadow:0 4px 30px rgba(124,58,237,.4);
          position:relative; overflow:hidden; white-space:nowrap;
        }
        .btn-primary::after {
          content:''; position:absolute; inset:0;
          background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%);
          background-size:200% 100%; background-position:200% 0;
          transition:background-position .4s;
        }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 12px 48px rgba(124,58,237,.55); }
        .btn-primary:hover::after { background-position:-200% 0; }

        .btn-ghost {
          display:inline-flex; align-items:center; gap:10px;
          background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12);
          color:#e2e8f0; font-weight:600; font-size:15px; padding:14px 28px;
          border-radius:14px; cursor:pointer; text-decoration:none; transition:all .25s; white-space:nowrap;
        }
        .btn-ghost:hover { background:rgba(255,255,255,0.09); border-color:rgba(255,255,255,0.2); transform:translateY(-2px); }

        /* ── Feature cards ─────────────────────────────────────────────────── */
        .feature-card {
          position:relative; background:rgba(255,255,255,0.025);
          border:1px solid rgba(255,255,255,0.07); border-radius:20px; padding:30px;
          transition:all .35s; overflow:hidden; backdrop-filter:blur(4px);
        }
        .feature-card::before {
          content:''; position:absolute; inset:-1px; border-radius:20px; z-index:-1;
          background: conic-gradient(from var(--angle,0deg), #7c3aed, #3b82f6, #06b6d4, #7c3aed);
          opacity:0; transition:opacity .35s;
        }
        .feature-card:hover { background:rgba(139,92,246,0.06); transform:translateY(-6px); box-shadow:0 24px 60px rgba(124,58,237,.15); }
        .feature-card:hover::before { opacity:1; }

        /* ── Messenger cards ───────────────────────────────────────────────── */
        .messenger-card {
          display:flex; flex-direction:column; align-items:center; gap:10px;
          background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.08);
          border-radius:18px; padding:22px 16px; transition:all .28s; min-width:96px; flex-shrink:0;
        }
        .messenger-card:hover { background:rgba(255,255,255,0.07); border-color:rgba(139,92,246,0.35); transform:translateY(-5px); box-shadow:0 16px 40px rgba(0,0,0,.5); }

        /* ── Marquee ───────────────────────────────────────────────────────── */
        .marquee-track { display:flex; gap:14px; animation:marquee 50s linear infinite; width:max-content; }
        .marquee-track:hover { animation-play-state:paused; }
        .marquee-wrap { overflow:hidden; mask-image:linear-gradient(to right,transparent,black 120px,black calc(100% - 120px),transparent); -webkit-mask-image:linear-gradient(to right,transparent,black 120px,black calc(100% - 120px),transparent); }

        /* ── Section helpers ───────────────────────────────────────────────── */
        .container { max-width:1200px; margin:0 auto; padding:0 28px; }
        .section { padding:104px 0; }
        .section-label { font-size:12px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:#a78bfa; margin-bottom:14px; }
        .section-title { font-size:clamp(30px,4.5vw,54px); font-weight:800; line-height:1.1; color:#f8fafc; letter-spacing:-.025em; }
        .section-sub { font-size:17px; color:rgba(255,255,255,0.42); line-height:1.85; margin-top:18px; }

        /* ── Divider ───────────────────────────────────────────────────────── */
        .divider { height:1px; background:linear-gradient(to right,transparent,rgba(139,92,246,0.2),rgba(59,130,246,0.2),transparent); }

        /* ── Nav ───────────────────────────────────────────────────────────── */
        .landing-nav { position:fixed; top:0; left:0; right:0; z-index:100; transition:all .35s; }
        .landing-nav.scrolled { background:rgba(3,7,18,0.88); backdrop-filter:blur(28px); border-bottom:1px solid rgba(255,255,255,0.06); }

        /* ── Pricing cards ─────────────────────────────────────────────────── */
        .pricing-card { border-radius:22px; position:relative; display:flex; flex-direction:column; flex:1; min-width:0; }
        .pricing-card.free { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.08); }
        .pricing-card.month { background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.1); }
        .pricing-card.year { background:rgba(124,58,237,0.07); border:1px solid rgba(139,92,246,0.35); box-shadow:0 0 80px rgba(124,58,237,.12); }
        .pricing-card.year:hover { box-shadow:0 0 100px rgba(124,58,237,.2); border-color:rgba(139,92,246,.55); }
        .plan-top { padding:30px 30px 0; min-height:172px; display:flex; flex-direction:column; justify-content:flex-start; }
        .plan-btn-wrap { padding:0 30px; }
        .plan-feats { padding:26px 30px 30px; flex:1; }
        .btn-plan-primary { display:block; width:100%; text-align:center; font-weight:700; font-size:15px; padding:14px; border-radius:14px; cursor:pointer; text-decoration:none; transition:all .25s; background:linear-gradient(135deg,#7c3aed,#3b82f6); color:#fff; box-shadow:0 4px 28px rgba(124,58,237,.4); border:none; }
        .btn-plan-primary:hover { transform:translateY(-2px); box-shadow:0 10px 40px rgba(124,58,237,.55); }
        .btn-plan-ghost { display:block; width:100%; text-align:center; font-weight:600; font-size:15px; padding:14px; border-radius:14px; cursor:pointer; text-decoration:none; transition:all .25s; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#e2e8f0; }
        .btn-plan-ghost:hover { background:rgba(255,255,255,0.1); transform:translateY(-2px); }
        .check-row { display:flex; align-items:flex-start; gap:11px; }
        .ci-ok { width:20px; height:20px; border-radius:50%; flex-shrink:0; margin-top:1px; display:flex; align-items:center; justify-content:center; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); }
        .ci-no { width:20px; height:20px; border-radius:50%; flex-shrink:0; margin-top:1px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); }

        /* ── OS cards ──────────────────────────────────────────────────────── */
        .os-card { display:flex; flex-direction:column; align-items:center; gap:11px; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.09); border-radius:18px; padding:26px 44px; text-decoration:none; transition:all .28s; min-width:170px; }
        .os-card:hover { border-color:rgba(139,92,246,0.5); background:rgba(124,58,237,0.08); transform:translateY(-6px); box-shadow:0 24px 60px rgba(124,58,237,.15); }
        .os-card.soon { opacity:.4; cursor:default; pointer-events:none; }

        /* ── Check circle ──────────────────────────────────────────────────── */
        .check-circle { width:22px; height:22px; border-radius:50%; flex-shrink:0; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.28); display:flex; align-items:center; justify-content:center; }
        .step-connector { position:absolute; top:30px; left:calc(50% + 36px); width:calc(100% - 72px); height:1px; background:linear-gradient(to right,rgba(124,58,237,0.5),rgba(59,130,246,0.15)); }

        /* ── Responsive ────────────────────────────────────────────────────── */
        @media (max-width:900px) {
          .hero-grid { grid-template-columns:1fr !important; gap:48px !important; }
          .app-window-wrap { display:none !important; }
          .hero-text { text-align:center; }
          .hero-text .hero-btns { justify-content:center !important; }
          .hero-text .hero-stats { justify-content:center !important; }
          .features-grid { grid-template-columns:1fr 1fr !important; }
          .steps-grid { grid-template-columns:1fr !important; gap:36px !important; }
          .step-connector { display:none; }
          .cloud-grid { grid-template-columns:1fr !important; }
          .pricing-grid { flex-direction:column !important; }
          .nav-links { display:none !important; }
          .download-grid { flex-direction:column !important; align-items:center !important; }
          .os-card { width:100%; max-width:340px; }
          .section { padding:72px 0 !important; }
          .plan-top { min-height:unset !important; }
        }
        @media (max-width:540px) {
          .features-grid { grid-template-columns:1fr !important; }
          .hero-stats { gap:32px !important; }
          .plan-top { padding:24px 22px 0 !important; }
          .plan-btn-wrap { padding:0 22px !important; }
          .plan-feats { padding:22px !important; }
        }
      `}</style>

      {supportOpen && <SupportModal t={t} onClose={() => setSupportOpen(false)} />}

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className={`landing-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 70, gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <img src="/logo.png" alt="Centrio" style={{ width: 30, height: 30, objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: 19, color: '#f8fafc', letterSpacing: '-.025em' }}>Centrio</span>
          </div>
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
            {([[t.nav_features,'#features'],[t.nav_messengers,'#messengers'],[t.nav_pricing,'#pricing'],[t.nav_download,'#download']] as [string,string][]).map(([l,h]) => (
              <a key={h} href={h} style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: 500, textDecoration: 'none', transition: 'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color='#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.45)')}>{l}</a>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <LangSwitcher lang={lang} setLang={setLang} />
            <Link href="/auth/login" style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', transition: 'all .2s', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.09)'; e.currentTarget.style.color='#f8fafc' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(255,255,255,0.55)' }}>
              {t.nav_dashboard}
            </Link>
            <a href={WIN_DOWNLOAD} className="btn-primary" style={{ fontSize: 13, padding: '9px 18px', borderRadius: 10 }}>
              {t.nav_dl_btn}
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: 70 }}>
        {/* Aurora background */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.28) 0%, transparent 70%)', top: '-20%', left: '-15%', animation: 'aurora1 14s ease-in-out infinite', filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 70%)', top: '10%', right: '-10%', animation: 'aurora2 18s ease-in-out infinite', filter: 'blur(70px)' }} />
          <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 70%)', bottom: '-10%', left: '30%', animation: 'aurora3 22s ease-in-out infinite', filter: 'blur(80px)' }} />
          {/* Grid dots */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.6 }} />
          {/* Vignette */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 0%, transparent 50%, #030712 100%)' }} />
        </div>

        <div className="container" style={{ position: 'relative', zIndex: 2, width: '100%' }}>
          <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>

            {/* Left: text */}
            <div className="hero-text" style={{ transform: `translate(${mouse.x * -8}px, ${mouse.y * -4}px)`, transition: 'transform .1s ease-out' }}>
              {/* Badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 50, padding: '7px 18px', fontSize: 13, fontWeight: 600, color: '#a78bfa', marginBottom: 30, position: 'relative' }}>
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#a78bfa', display: 'inline-block' }} />
                  <span style={{ position: 'absolute', width: 7, height: 7, borderRadius: '50%', background: '#a78bfa', animation: 'pulse-ring 1.8s ease-out infinite' }} />
                </span>
                v{VERSION} · {t.hero_badge}
              </div>

              <h1 style={{ fontSize: 'clamp(40px,5.5vw,72px)', fontWeight: 900, lineHeight: 1.08, color: '#f8fafc', marginBottom: 24, letterSpacing: '-.03em' }}>
                {t.hero_h1a}<br /><span className="gradient-text">{t.hero_h1b}</span>
              </h1>
              <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.48)', lineHeight: 1.85, marginBottom: 44, maxWidth: 500 }}>{t.hero_sub}</p>

              <div className="hero-btns" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 56 }}>
                <a href={WIN_DOWNLOAD} className="btn-primary">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {t.hero_cta}
                </a>
                <a href="#pricing" className="btn-ghost">{t.hero_cta2}</a>
              </div>

              {/* Stats with animated counters */}
              <div className="hero-stats" style={{ display: 'flex', gap: 52 }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#f8fafc', letterSpacing: '-.03em', lineHeight: 1 }}>
                    <span ref={c1.ref}>{c1.val}</span>+
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', marginTop: 5 }}>{t.stat1l}</div>
                </div>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#f8fafc', letterSpacing: '-.03em', lineHeight: 1 }}>
                    <span ref={c2.ref}>{c2.val >= 1000 ? `${Math.floor(c2.val/1000)}K` : c2.val}</span>+
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', marginTop: 5 }}>{t.stat2l}</div>
                </div>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#f8fafc', letterSpacing: '-.03em', lineHeight: 1 }}>
                    <span ref={c3.ref}>{c3.val}</span>.{String(VERSION).split('.')[2]}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', marginTop: 5 }}>{t.stat3l}</div>
                </div>
              </div>
            </div>

            {/* Right: App mockup */}
            <div className="app-window-wrap" style={{ animation: 'float 8s ease-in-out infinite', animationDelay: '.5s', position: 'relative', padding: '28px 28px 28px 12px', transform: `translate(${mouse.x * 12}px, ${mouse.y * 6}px)`, transition: 'transform .12s ease-out' }}>
              {/* Ambient glow */}
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 60% 50%, rgba(124,58,237,0.22) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

              {/* Floating notification */}
              <div style={{ position: 'absolute', top: 6, right: 0, zIndex: 20, background: 'rgba(8,12,28,0.94)', backdropFilter: 'blur(24px)', border: '1px solid rgba(139,92,246,0.22)', borderRadius: 16, padding: '12px 15px', width: 210, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', animation: 'float2 6s ease-in-out infinite', animationDelay: '1s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#5865F2,#4752d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0 }}>D</div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#f8fafc' }}>Discord</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>только что</div>
                  </div>
                  <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 10px #a78bfa', flexShrink: 0 }} />
                </div>
                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>@Коллеги: Встреча в 15:00 ✓</p>
              </div>

              {/* Main window */}
              <div style={{ position: 'relative', zIndex: 10, background: 'linear-gradient(160deg, rgba(12,16,40,0.98) 0%, rgba(5,8,20,0.99) 100%)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 48px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04), 0 0 80px rgba(124,58,237,0.12)' }}>
                {/* Title bar */}
                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['#ef4444','rgba(239,68,68,0.5)'],['#f59e0b','rgba(245,158,11,0.5)'],['#22c55e','rgba(34,197,94,0.5)']].map(([c,g]) => (
                      <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c, boxShadow: `0 0 8px ${g}` }} />
                    ))}
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                    <img src="/logo.png" alt="" style={{ width: 13, height: 13, objectFit: 'contain', opacity: .6 }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' }}>Centrio</span>
                  </div>
                  <div style={{ width: 52 }} />
                </div>

                <div style={{ display: 'flex', height: 390 }}>
                  {/* Sidebar */}
                  <div style={{ width: 58, background: 'rgba(0,0,0,0.3)', borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 10 }}>
                    {[
                      {bg:'linear-gradient(145deg,#2AABEE,#1a8fd1)',sh:'rgba(42,171,238,0.4)',l:'T',b:3,a:true},
                      {bg:'linear-gradient(145deg,#25D366,#18a04c)',sh:'rgba(37,211,102,0.3)',l:'W',b:7,a:false},
                      {bg:'linear-gradient(145deg,#5865F2,#4752c4)',sh:'rgba(88,101,242,0.3)',l:'D',b:0,a:false},
                      {bg:'linear-gradient(145deg,#0077FF,#0055cc)',sh:'rgba(0,119,255,0.3)',l:'V',b:2,a:false},
                      {bg:'linear-gradient(145deg,#E1306C,#b52456)',sh:'rgba(225,48,108,0.3)',l:'I',b:0,a:false},
                    ].map((m,i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <div style={{ width: 36, height: 36, borderRadius: m.a ? 11 : 18, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', boxShadow: `0 4px 16px ${m.sh}`, outline: m.a ? '2px solid rgba(167,139,250,0.8)' : 'none', outlineOffset: 2, transition: 'border-radius .2s' }}>{m.l}</div>
                        {m.b > 0 && <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, background: '#ef4444', fontSize: 9, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #050810', boxShadow: '0 0 10px rgba(239,68,68,0.6)' }}>{m.b}</div>}
                      </div>
                    ))}
                    <div style={{ flex: 1 }} />
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.1)', border: '1px dashed rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'rgba(167,139,250,0.6)', lineHeight: 1 }}>+</div>
                  </div>

                  {/* Chat area */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Tabs */}
                    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 2, padding: '5px 8px', background: 'rgba(0,0,0,0.18)' }}>
                      {[['Telegram','#2AABEE',true],['WhatsApp','#25D366',false],['Discord','#5865F2',false]].map(([n,c,a]) => (
                        <div key={n as string} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, background: (a as boolean) ? 'rgba(255,255,255,0.08)' : 'transparent', color: (a as boolean) ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)' }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: c as string, boxShadow: `0 0 6px ${c as string}` }} />{n as string}
                        </div>
                      ))}
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'hidden' }}>
                      {[
                        {r:false,t:'Привет! Как насчёт встречи?',a:'А',ts:'10:24'},
                        {r:true,t:'Да, давай в 15:00',a:'Я',ts:'10:25'},
                        {r:false,t:'Окей! Встретимся у офиса 📍',a:'А',ts:'10:26'},
                        {r:true,t:'Договорились ✓✓',a:'Я',ts:'10:27'},
                      ].map((m,i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: m.r ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
                          {!m.r && <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#2AABEE,#1a8fd1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#fff' }}>{m.a}</div>}
                          <div>
                            <div style={{ background: m.r ? 'linear-gradient(135deg,rgba(124,58,237,0.85),rgba(59,130,246,0.8))' : 'rgba(255,255,255,0.06)', border: m.r ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.06)', borderRadius: m.r ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '8px 13px', fontSize: 11.5, color: 'rgba(255,255,255,0.9)', maxWidth: 200, lineHeight: 1.5, boxShadow: m.r ? '0 4px 20px rgba(124,58,237,0.25)' : 'none' }}>{m.t}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.16)', marginTop: 3, textAlign: m.r ? 'right' : 'left', paddingInline: 4 }}>{m.ts}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Input */}
                    <div style={{ padding: '9px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(0,0,0,0.22)' }}>
                      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, flex: 1, padding: '9px 14px', fontSize: 11.5, color: 'rgba(255,255,255,0.18)' }}>Написать сообщение...</div>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(124,58,237,0.5)', flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div style={{ position: 'absolute', bottom: 42, left: -12, zIndex: 20, background: 'rgba(8,12,28,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: 50, padding: '9px 18px', display: 'flex', alignItems: 'center', gap: 9, boxShadow: '0 10px 32px rgba(0,0,0,0.5)', animation: 'float2 7s ease-in-out infinite', animationDelay: '2s' }}>
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  <span style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse-ring 1.6s ease-out infinite' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap' }}>7 сервисов онлайн</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── MESSENGERS MARQUEE ──────────────────────────────────────────────── */}
      <section id="messengers" style={{ padding: '80px 0' }}>
        <div className="container" style={{ textAlign: 'center', marginBottom: 52 }}>
          <div className="section-label reveal">{t.ms_label}</div>
          <h2 className="reveal delay-1" style={{ fontSize: 'clamp(26px,3.5vw,44px)', fontWeight: 800, color: '#f8fafc', letterSpacing: '-.025em' }}>{t.ms_title}</h2>
          <p className="reveal delay-2" style={{ color: 'rgba(255,255,255,0.38)', fontSize: 15, marginTop: 12 }}>{t.ms_sub}</p>
        </div>
        <div className="marquee-wrap">
          <div className="marquee-track">
            {[...Array(2)].flatMap((_, rep) =>
              messengers.map((m, i) => (
                <div key={`${rep}-${i}`} className="messenger-card">
                  <div style={{ width: 54, height: 54, borderRadius: 15, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', boxShadow: `0 6px 20px ${m.color}55` }}>
                    {m.img ? <img src={m.img} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : MessengerSvgs[m.svg!]}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', textAlign: 'center' }}>{m.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section id="features" className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div className="section-label reveal">{t.feat_label}</div>
            <h2 className="section-title reveal delay-1">{t.feat_title}<br /><span className="gradient-text">{t.feat_title2}</span></h2>
            <p className="section-sub reveal delay-2" style={{ maxWidth: 520, margin: '18px auto 0' }}>{t.feat_sub}</p>
          </div>
          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {features.map((f, i) => (
              <div key={i} className={`feature-card reveal delay-${(i % 3) + 1}`}>
                <div style={{ width: 52, height: 52, borderRadius: 15, background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(59,130,246,0.15))', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <FeatureIcon name={f.icon} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 10, letterSpacing: '-.015em' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.42)', lineHeight: 1.8 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section style={{ padding: '104px 0', background: 'linear-gradient(180deg, rgba(124,58,237,0.03) 0%, transparent 100%)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div className="section-label reveal">{t.how_label}</div>
            <h2 className="section-title reveal delay-1">{t.how_title}<span className="gradient-text">{t.how_title2}</span></h2>
          </div>
          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 48, position: 'relative' }}>
            {[
              { n:'01', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>, title: t.step1t, desc: t.step1d },
              { n:'02', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>, title: t.step2t, desc: t.step2d },
              { n:'03', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>, title: t.step3t, desc: t.step3d },
            ].map((s, i) => (
              <div key={i} className={`reveal delay-${i + 1}`} style={{ textAlign: 'center', position: 'relative' }}>
                {i < 2 && <div className="step-connector" />}
                <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 24px', background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(59,130,246,0.12))', border: '1px solid rgba(139,92,246,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, boxShadow: '0 0 40px rgba(124,58,237,0.12)' }}>{s.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: 'rgba(167,139,250,0.5)', marginBottom: 12 }}>{s.n}</div>
                <h3 style={{ fontSize: 21, fontWeight: 700, color: '#f8fafc', marginBottom: 12, letterSpacing: '-.02em' }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', lineHeight: 1.8, maxWidth: 260, margin: '0 auto' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLOUD SYNC ──────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div className="cloud-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 88, alignItems: 'center' }}>
            <div className="reveal" style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -60, background: 'radial-gradient(ellipse at 40% 50%, rgba(124,58,237,0.12), transparent 65%)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(139,92,246,0.22)', borderRadius: 18, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 24px rgba(124,58,237,0.35)' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Синхронизация активна</div>
                    <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13 }}>Последняя синхронизация: только что</div>
                  </div>
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 14px #22c55e', display: 'inline-block' }} />
                    <span style={{ position: 'absolute', width: 10, height: 10, borderRadius: '50%', background: '#22c55e', animation: 'pulse-ring 2s ease-out infinite' }} />
                  </div>
                </div>
                {[
                  { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>, txt:'7 мессенджеров синхронизировано' },
                  { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>, txt:'3 папки и настройки сохранены' },
                  { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>, txt:'Тема и интерфейс перенесены' },
                  { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, txt:'Настройки уведомлений обновлены' },
                ].map((item,i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 13, transition: 'all .25s' }}>
                    {item.icon}
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.52)', flex: 1 }}>{item.txt}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                ))}
              </div>
            </div>
            <div className="reveal delay-2">
              <div className="section-label">{t.cloud_label}</div>
              <h2 className="section-title">{t.cloud_title}<span className="gradient-text">{t.cloud_title2}</span></h2>
              <p className="section-sub">{t.cloud_sub}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 36 }}>
                {[t.cloud_f1, t.cloud_f2, t.cloud_f3, t.cloud_f4].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                    <div className="check-circle"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.58)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── PRICING ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124,58,237,0.07), transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: 68 }}>
            <div className="section-label reveal">{t.pr_label}</div>
            <h2 className="section-title reveal delay-1">{t.pr_title}</h2>
            <p className="section-sub reveal delay-2" style={{ maxWidth: 480, margin: '18px auto 0' }}>{t.pr_sub}</p>
          </div>
          <div className="pricing-grid" style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>

            {/* FREE */}
            <div className="pricing-card free reveal delay-1">
              <div className="plan-top">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>{t.plan_free}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 46, fontWeight: 900, color: '#f8fafc', letterSpacing: '-.04em' }}>0 ₽</span>
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.28)' }}>{t.plan_free_sub}</div>
              </div>
              <div className="plan-btn-wrap" style={{ padding: '22px 30px 0' }}>
                <a href={WIN_DOWNLOAD} className="btn-plan-ghost">{t.plan_free_btn}</a>
              </div>
              <div className="plan-feats">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {t.feat_items_free.map((txt: string, i: number) => (
                    <div key={i} className="check-row">
                      <div className="ci-ok"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                      <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>{txt}</span>
                    </div>
                  ))}
                  {t.feat_items_no.map((txt: string, i: number) => (
                    <div key={i} className="check-row">
                      <div className="ci-no"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
                      <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.2)', lineHeight: 1.55 }}>{txt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PRO MONTH */}
            <div className="pricing-card month reveal delay-2">
              <div className="plan-top">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#a78bfa', marginBottom: 14 }}>{t.plan_month}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 46, fontWeight: 900, color: '#f8fafc', letterSpacing: '-.04em' }}>199 ₽</span>
                  <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.32)' }}>/мес</span>
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.32)' }}>{t.plan_month_sub}</div>
              </div>
              <div className="plan-btn-wrap" style={{ padding: '22px 30px 0' }}>
                <a href="/auth/login" className="btn-plan-ghost" style={{ borderColor: 'rgba(139,92,246,0.35)', color: '#a78bfa' }}>{t.plan_month_btn}</a>
              </div>
              <div className="plan-feats">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {t.feat_items_pro.map((txt: string, i: number) => (
                    <div key={i} className="check-row">
                      <div className="ci-ok"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                      <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>{txt}</span>
                    </div>
                  ))}
                  {t.feat_items_pro_no.map((txt: string, i: number) => (
                    <div key={i} className="check-row">
                      <div className="ci-no"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
                      <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.2)', lineHeight: 1.55 }}>{txt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PRO YEAR */}
            <div className="pricing-card year reveal delay-3">
              <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '6px 20px', borderRadius: '0 0 14px 14px', whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>{t.plan_year_badge}</div>
              <div className="plan-top" style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#a78bfa', marginBottom: 14 }}>{t.plan_year}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 46, fontWeight: 900, color: '#f8fafc', letterSpacing: '-.04em' }}>133 ₽</span>
                  <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.32)' }}>/мес</span>
                </div>
                <div style={{ fontSize: 14 }}>
                  <span style={{ color: 'rgba(255,255,255,0.22)', textDecoration: 'line-through', marginRight: 10 }}>2 388 ₽</span>
                  <span style={{ color: '#4ade80', fontWeight: 700 }}>1 590 ₽/год</span>
                </div>
              </div>
              <div className="plan-btn-wrap" style={{ padding: '22px 30px 0' }}>
                <a href="/auth/login" className="btn-plan-primary">{t.plan_year_btn}</a>
              </div>
              <div className="plan-feats">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)', borderRadius: 50, padding: '5px 14px', fontSize: 12, fontWeight: 700, color: '#4ade80', marginBottom: 18 }}>{t.plan_year_save}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {t.feat_items_pro_year.map((txt: string, i: number) => (
                    <div key={i} className="check-row">
                      <div className="ci-ok"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                      <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>{txt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
          <div style={{ textAlign: 'center', marginTop: 36, fontSize: 13, color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
            <span>{t.pay_secure}</span><span>·</span>
            <span>{t.pay_cards}</span><span>·</span>
            <span>{t.pay_instant}</span><span>·</span>
            <span>{t.pay_cancel}</span>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── DOWNLOAD ────────────────────────────────────────────────────────── */}
      <section id="download" className="section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)', bottom: '-20%', left: '50%', transform: 'translateX(-50%)', filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        </div>
        <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div className="section-label reveal">{t.dl_label}</div>
          <h2 className="section-title reveal delay-1" style={{ marginBottom: 18 }}>{t.dl_title}</h2>
          <p className="section-sub reveal delay-2" style={{ maxWidth: 480, margin: '0 auto 56px' }}>{t.dl_sub}</p>
          <div className="download-grid reveal delay-3" style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
            {[
              { os: t.os_win, sub: t.dl_win_sub, href: '/download/windows', available: true, icon: OsIcons.windows, color: '#60a5fa' },
              { os: t.os_mac, sub: t.dl_mac_sub, href: '/download/macos', available: true, icon: OsIcons.macos, color: '#c4b5fd' },
              { os: t.os_lin, sub: t.dl_lin_sub, href: '/download/linux', available: true, icon: OsIcons.linux, color: '#fb923c' },
            ].map(p => (
              <a key={p.os} href={p.href} className={`os-card${p.available ? '' : ' soon'}`} style={{ color: p.available ? '#f8fafc' : 'rgba(255,255,255,0.4)' }}>
                <div style={{ color: p.available ? p.color : 'rgba(255,255,255,0.25)', marginBottom: 4 }}>{p.icon}</div>
                <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-.015em' }}>{p.os}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)' }}>{p.sub}</span>
              </a>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.18)' }}>v{VERSION} · Бесплатно</p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '44px 0 28px' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img src="/logo.png" alt="Centrio" style={{ width: 24, height: 24, objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, color: 'rgba(255,255,255,0.35)', fontSize: 15, letterSpacing: '-.015em' }}>Centrio</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)', marginLeft: 4 }}>v{VERSION}</span>
          </div>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.18)' }}>{t.footer_rights}</span>
          <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { href: '/dashboard', label: t.nav_dashboard },
              { href: '/faq', label: t.footer_faq },
              { href: '/privacy', label: t.footer_privacy },
              { href: '/terms', label: t.footer_terms },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', transition: 'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color='rgba(255,255,255,0.65)')}
                onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.3)')}>{l.label}</Link>
            ))}
            <button onClick={() => setSupportOpen(true)} style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.color='rgba(255,255,255,0.65)')}
              onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.3)')}>{t.footer_support}</button>
            <Link href="/blog/vs-rambox" style={{ fontSize: 13, color: 'rgba(255,255,255,0.22)', textDecoration: 'none' }}>vs Rambox</Link>
            <Link href="/blog/vs-franz" style={{ fontSize: 13, color: 'rgba(255,255,255,0.22)', textDecoration: 'none' }}>vs Franz</Link>
          </div>
        </div>
        <div className="container" style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.13)', lineHeight: 1.8 }}>
            ИП Козловский Артём Сергеевич · ИНН: 501908743800 · ОГРНИП: 326508100200742<br />
            Использование сервиса означает согласие с{' '}
            <Link href="/terms" style={{ color: 'rgba(255,255,255,0.22)', textDecoration: 'underline' }}>Условиями использования</Link>
            {' '}и{' '}
            <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.22)', textDecoration: 'underline' }}>Политикой конфиденциальности</Link>.
          </p>
        </div>
      </footer>
    </>
  )
}
