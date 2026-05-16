'use client'

import { useState, useEffect, useRef, type ReactElement } from 'react'
import Link from 'next/link'
import { useLang, LANGS, LANG_LABELS, type Lang } from '@/lib/i18n'
import {
  motion, AnimatePresence,
  useMotionValue, useSpring, useTransform,
} from 'framer-motion'
import { GlassPricingSection, type PricingCardProps } from '@/components/ui/animated-glassy-pricing'

const VERSION = '1.6.90'
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
  linux: (<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" fill="currentColor" viewBox="0 0 16 16"><path d="M2.273 9.53a2.273 2.273 0 1 0 0-4.546 2.273 2.273 0 0 0 0 4.547Zm9.467-4.984a2.273 2.273 0 1 0 0-4.546 2.273 2.273 0 0 0 0 4.546M7.4 13.108a5.54 5.54 0 0 1-3.775-2.88 3.27 3.27 0 0 1-1.944.24 7.4 7.4 0 0 0 5.328 4.465c.53.113 1.072.169 1.614.166a3.25 3.25 0 0 1-.666-1.9 6 6 0 0 1-.557-.091m3.828 2.285a2.273 2.273 0 1 0 0-4.546 2.273 2.273 0 0 0 0 4.546m3.163-3.108a7.44 7.44 0 0 0 .373-8.726 3.3 3.3 0 0 1-1.278 1.498 5.57 5.57 0 0 1-.183 5.535 3.26 3.26 0 0 1 1.088 1.693M2.098 3.998a3.3 3.3 0 0 1 1.897.486 5.54 5.54 0 0 1 4.464-2.388c.037-.67.277-1.313.69-1.843a7.47 7.47 0 0 0-7.051 3.745"/></svg>),
}

function FeatureIcon({ name }: { name: string }) {
  const s = { viewBox: '0 0 24 24', fill: 'none', stroke: 'url(#ig)', strokeWidth: '1.8', width: '22', height: '22' } as const
  const grad = <defs><linearGradient id="ig" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#e879f9"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs>
  if (name === 'grid') return <svg {...s}>{grad}<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
  if (name === 'bell') return <svg {...s}>{grad}<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
  if (name === 'folder') return <svg {...s}>{grad}<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
  if (name === 'globe') return <svg {...s}>{grad}<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  if (name === 'theme') return <svg {...s}>{grad}<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
  if (name === 'lock') return <svg {...s}>{grad}<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  if (name === 'cloud') return <svg {...s}>{grad}<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  if (name === 'sound') return <svg {...s}>{grad}<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
  if (name === 'update') return <svg {...s}>{grad}<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
  return null
}

/* framer-motion variants reused across the page */
const EASE = 'easeOut' as const
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.65, ease: EASE } },
}
const fadeUpDelay = (d: number) => ({
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.65, ease: EASE, delay: d } },
})

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
  const inp: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '11px 14px', color: '#f0f0ff', fontSize: 14, outline: 'none', transition: 'border-color .2s', fontFamily: 'inherit' }
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)' }} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        style={{ position: 'relative', zIndex: 1, background: 'rgba(8,7,20,0.98)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 22, padding: '38px 34px', width: '100%', maxWidth: 450, boxShadow: '0 32px 100px rgba(0,0,0,0.9)' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>×</button>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>
            <p style={{ color: '#f0f0ff', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{t.sup_sent}</p>
            <button onClick={onClose} style={{ marginTop: 18, background: 'linear-gradient(135deg,#d946ef,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 11, padding: '10px 28px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>{t.sup_close}</button>
          </div>
        ) : (
          <form onSubmit={handleSend}>
            <h3 style={{ color: '#f0f0ff', fontSize: 21, fontWeight: 800, marginBottom: 26, letterSpacing: '-.02em' }}>{t.sup_title}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input style={inp} placeholder={t.sup_name} value={name} onChange={e => setName(e.target.value)} required />
              <input style={inp} type="email" placeholder={t.sup_email} value={email} onChange={e => setEmail(e.target.value)} required />
              <textarea style={{ ...inp, resize: 'vertical', minHeight: 100 }} placeholder={t.sup_msg} value={msg} onChange={e => setMsg(e.target.value)} required />
            </div>
            <button type="submit" disabled={sending} style={{ marginTop: 20, width: '100%', background: 'linear-gradient(135deg,#d946ef,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', opacity: sending ? 0.7 : 1, transition: 'all .2s', fontFamily: 'inherit' }}>
              {sending ? '...' : t.sup_send}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
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
      <button onClick={() => setOpen(!open)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 9, padding: '7px 12px', color: 'rgba(240,240,255,0.55)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all .2s' }}>
        {LANG_LABELS[lang]}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 7px)', right: 0, background: 'rgba(8,7,20,0.98)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, overflow: 'hidden', zIndex: 50, minWidth: 126, boxShadow: '0 16px 60px rgba(0,0,0,0.8)' }}>
          {LANGS.map(l => (
            <button key={l} onClick={() => { setLang(l); setOpen(false) }} style={{ display: 'block', width: '100%', padding: '9px 16px', background: l === lang ? 'rgba(168,85,247,0.1)' : 'transparent', border: 'none', color: l === lang ? '#c084fc' : 'rgba(240,240,255,0.5)', fontSize: 13, fontWeight: l === lang ? 700 : 400, cursor: 'pointer', textAlign: 'left', transition: 'all .15s', fontFamily: 'inherit' }}>
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

  /* ── mouse parallax via framer-motion springs ─────────────────────────── */
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const springX = useSpring(rawX, { stiffness: 60, damping: 18 })
  const springY = useSpring(rawY, { stiffness: 60, damping: 18 })
  const heroLeftX  = useTransform(springX, v => v * -6)
  const heroLeftY  = useTransform(springY, v => v * -3)
  const heroRightX = useTransform(springX, v => v *  10)
  const heroRightY = useTransform(springY, v => v *  5)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      rawX.set((e.clientX / window.innerWidth  - 0.5) * 2)
      rawY.set((e.clientY / window.innerHeight - 0.5) * 2)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [rawX, rawY])

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
        body {
          background: #06060f;
          color: #e8e8ff;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          overflow-x: hidden;
        }

        /* ── Global dot grid ─────────────────────────────────────────────────── */
        body::before {
          content: '';
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image: radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .page { position: relative; z-index: 1; }

        /* ── Keyframes ───────────────────────────────────────────────────────── */
        @keyframes grad-shift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(2.5);opacity:0} }
        @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes blob-drift { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-40px,-30px) scale(1.08)} 66%{transform:translate(30px,20px) scale(.94)} }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes typing-dot { 0%,60%,100%{transform:translateY(0);opacity:.35} 30%{transform:translateY(-4px);opacity:1} }

        /* ── Gradient text ───────────────────────────────────────────────────── */
        .gt {
          background: linear-gradient(135deg, #f0abfc 0%, #a855f7 40%, #38bdf8 100%);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: shimmer 5s linear infinite;
        }

        /* ── Layout ──────────────────────────────────────────────────────────── */
        .wrap { max-width: 1160px; margin: 0 auto; padding: 0 24px; }
        .sec  { padding: 100px 0; }

        /* ── Section tag ─────────────────────────────────────────────────────── */
        .stag {
          display: inline-flex; align-items: center; gap: 10px;
          font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #c084fc;
          margin-bottom: 16px;
        }
        .stag::before, .stag::after { content:''; display:block; width:20px; height:1px; background: linear-gradient(to right, #c084fc, transparent); }
        .stag::after { background: linear-gradient(to left, #c084fc, transparent); }

        /* ── Section heading ─────────────────────────────────────────────────── */
        .sh { font-size: clamp(28px,4vw,50px); font-weight: 800; line-height: 1.1; color: #f0f0ff; letter-spacing: -.025em; }
        .sp { font-size: 16px; color: rgba(240,240,255,.4); line-height: 1.9; margin-top: 14px; }

        /* ── Divider ─────────────────────────────────────────────────────────── */
        .hr { height: 1px; background: linear-gradient(to right, transparent, rgba(168,85,247,.18), rgba(56,189,248,.12), transparent); }

        /* ── Nav ─────────────────────────────────────────────────────────────── */
        .lnav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; transition: all .3s; }
        .lnav.sc { background: rgba(6,6,15,.9); backdrop-filter: blur(28px); border-bottom: 1px solid rgba(255,255,255,.05); }
        .nlink { color: rgba(240,240,255,.38); font-size: 14px; font-weight: 500; text-decoration: none; transition: color .2s; }
        .nlink:hover { color: #f0f0ff; }

        /* ── Buttons ─────────────────────────────────────────────────────────── */
        .btn-g {
          display: inline-flex; align-items: center; gap: 9px;
          background: linear-gradient(135deg, #d946ef, #8b5cf6 50%, #38bdf8);
          background-size: 200% auto;
          color: #fff; font-weight: 700; font-size: 14.5px; padding: 13px 26px;
          border-radius: 12px; border: none; cursor: pointer; text-decoration: none;
          transition: all .3s; box-shadow: 0 4px 28px rgba(168,85,247,.35);
          position: relative; overflow: hidden; white-space: nowrap; font-family: inherit;
          animation: grad-shift 4s ease infinite;
        }
        .btn-g:hover { transform: translateY(-2px); box-shadow: 0 14px 50px rgba(168,85,247,.55); background-position: right center; }

        .btn-o {
          display: inline-flex; align-items: center; gap: 9px;
          background: transparent; border: 1px solid rgba(255,255,255,.11);
          color: rgba(240,240,255,.7); font-weight: 600; font-size: 14.5px; padding: 13px 26px;
          border-radius: 12px; cursor: pointer; text-decoration: none; transition: all .25s; white-space: nowrap;
        }
        .btn-o:hover { border-color: rgba(168,85,247,.45); color: #f0f0ff; background: rgba(168,85,247,.06); transform: translateY(-2px); }

        /* ── Glass card ──────────────────────────────────────────────────────── */
        .gc {
          background: linear-gradient(135deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,.025) 100%);
          border: 1px solid rgba(168,85,247,.18);
          border-radius: 20px;
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          transition: all .35s cubic-bezier(.22,1,.36,1);
          position: relative; overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 1px rgba(56,189,248,.04);
        }
        .gc::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(168,85,247,.35), rgba(56,189,248,.25), transparent);
        }
        .gc::after {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(168,85,247,.9), rgba(56,189,248,.7), transparent);
          opacity: 0; transition: opacity .3s;
        }
        .gc:hover { background: linear-gradient(135deg, rgba(168,85,247,.1) 0%, rgba(56,189,248,.05) 100%); border-color: rgba(168,85,247,.35); transform: translateY(-6px); box-shadow: 0 24px 60px rgba(0,0,0,.4), 0 0 50px rgba(168,85,247,.1), inset 0 1px 0 rgba(255,255,255,.12); }
        .gc:hover::after { opacity: 1; }

        /* ── Feature icon box ────────────────────────────────────────────────── */
        .fi {
          width: 48px; height: 48px; border-radius: 13px; margin-bottom: 18px;
          background: linear-gradient(135deg, rgba(217,70,239,.1), rgba(56,189,248,.07));
          border: 1px solid rgba(168,85,247,.18);
          display: flex; align-items: center; justify-content: center;
        }

        /* ── Messenger card ──────────────────────────────────────────────────── */
        .mc {
          display: flex; flex-direction: column; align-items: center; gap: 9px;
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
          border-radius: 15px; padding: 18px 14px; transition: all .25s; min-width: 88px; flex-shrink: 0;
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 2px 12px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.06);
        }
        .mc:hover { background: rgba(168,85,247,.07); border-color: rgba(168,85,247,.28); transform: translateY(-5px); box-shadow: 0 14px 36px rgba(0,0,0,.5); }

        /* ── Marquee ─────────────────────────────────────────────────────────── */
        .mq-track { display: flex; gap: 12px; animation: marquee 44s linear infinite; width: max-content; }
        .mq-track:hover { animation-play-state: paused; }
        .mq-wrap { overflow: hidden; mask-image: linear-gradient(to right, transparent, black 90px, black calc(100% - 90px), transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 90px, black calc(100% - 90px), transparent); }

        /* ── Pricing ─────────────────────────────────────────────────────────── */
        .pc { border-radius: 20px; position: relative; display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .pc.t-free  { background: rgba(255,255,255,.022); border: 1px solid rgba(255,255,255,.07); }
        .pc.t-month { background: rgba(255,255,255,.03);  border: 1px solid rgba(255,255,255,.09); }
        .pc.t-year  { background: rgba(168,85,247,.06);   border: 1px solid rgba(168,85,247,.28); box-shadow: 0 0 80px rgba(168,85,247,.1); transition: all .3s; }
        .pc.t-year:hover { box-shadow: 0 0 120px rgba(168,85,247,.2); border-color: rgba(168,85,247,.45); }
        .pt  { padding: 28px 28px 0; min-height: 166px; display: flex; flex-direction: column; }
        .pb  { padding: 0 28px; }
        .pf  { padding: 22px 28px 28px; flex: 1; }
        .btn-pp { display: block; width: 100%; text-align: center; font-weight: 700; font-size: 14.5px; padding: 13px; border-radius: 12px; cursor: pointer; text-decoration: none; transition: all .25s; background: linear-gradient(135deg,#d946ef,#8b5cf6,#38bdf8); color: #fff; box-shadow: 0 4px 28px rgba(168,85,247,.35); border: none; font-family: inherit; }
        .btn-pp:hover { transform: translateY(-2px); box-shadow: 0 12px 44px rgba(168,85,247,.5); }
        .btn-pg { display: block; width: 100%; text-align: center; font-weight: 600; font-size: 14.5px; padding: 13px; border-radius: 12px; cursor: pointer; text-decoration: none; transition: all .25s; background: transparent; border: 1px solid rgba(255,255,255,.1); color: rgba(240,240,255,.65); font-family: inherit; }
        .btn-pg:hover { background: rgba(255,255,255,.055); transform: translateY(-2px); border-color: rgba(168,85,247,.3); }
        .cr  { display: flex; align-items: flex-start; gap: 10px; }
        .cy  { width: 19px; height: 19px; border-radius: 50%; flex-shrink: 0; margin-top: 1px; display: flex; align-items: center; justify-content: center; background: rgba(34,197,94,.1); border: 1px solid rgba(34,197,94,.27); }
        .cn  { width: 19px; height: 19px; border-radius: 50%; flex-shrink: 0; margin-top: 1px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); }

        /* ── OS card ─────────────────────────────────────────────────────────── */
        .osc { display: flex; flex-direction: column; align-items: center; gap: 10px; background: linear-gradient(135deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,.02) 100%); border: 1px solid rgba(255,255,255,.09); border-radius: 18px; padding: 26px 40px; text-decoration: none; transition: all .28s; min-width: 158px; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 4px 20px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.07); }
        .osc:hover { border-color: rgba(168,85,247,.45); background: rgba(168,85,247,.07); transform: translateY(-6px); box-shadow: 0 24px 60px rgba(168,85,247,.14); }

        /* ── Check circle ────────────────────────────────────────────────────── */
        .cc { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; background: rgba(34,197,94,.1); border: 1px solid rgba(34,197,94,.25); display: flex; align-items: center; justify-content: center; }
        .sconn { position: absolute; top: 30px; left: calc(50% + 36px); width: calc(100% - 72px); height: 1px; background: linear-gradient(to right, rgba(168,85,247,.4), rgba(56,189,248,.08)); }

        /* ── Footer ──────────────────────────────────────────────────────────── */
        .fl { display: block; font-size: 13.5px; color: rgba(240,240,255,.38); text-decoration: none; margin-bottom: 9px; transition: color .2s; }
        .fl:hover { color: rgba(240,240,255,.78); }
        .flh { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: rgba(240,240,255,.28); margin-bottom: 16px; display: block; }

        /* ── Responsive ──────────────────────────────────────────────────────── */
        @media (max-width: 900px) {
          .hgrid  { grid-template-columns: 1fr !important; gap: 48px !important; }
          .appwin { display: none !important; }
          .htxt   { text-align: center; }
          .hbtns  { justify-content: center !important; }
          .hstat  { justify-content: center !important; }
          .fgrid  { grid-template-columns: 1fr 1fr !important; }
          .sgrid  { grid-template-columns: 1fr !important; gap: 32px !important; }
          .cgrid  { grid-template-columns: 1fr !important; }
          .pwrap  { flex-direction: column !important; }
          .navlinks { display: none !important; }
          .dlwrap { flex-direction: column !important; align-items: center !important; }
          .sec    { padding: 68px 0 !important; }
          .pt     { min-height: unset !important; }
          .ftcols { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 540px) {
          .fgrid  { grid-template-columns: 1fr !important; }
          .pt     { padding: 22px 20px 0 !important; }
          .pb     { padding: 0 20px !important; }
          .pf     { padding: 20px 20px 22px !important; }
          .ftcols { grid-template-columns: 1fr !important; }
          .sconn  { display: none; }
        }
      `}</style>

      <AnimatePresence>
        {supportOpen && <SupportModal t={t} onClose={() => setSupportOpen(false)} />}
      </AnimatePresence>

      <div className="page">

        {/* ── NAV ──────────────────────────────────────────────────────────────── */}
        <nav className={`lnav${scrolled ? ' sc' : ''}`}>
          <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66, gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
              <img src="/logo.png" alt="Centrio" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <span style={{ fontWeight: 800, fontSize: 18, color: '#f0f0ff', letterSpacing: '-.025em' }}>Centrio</span>
            </div>
            <div className="navlinks" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
              {([[t.nav_features,'#features'],[t.nav_messengers,'#messengers'],[t.nav_pricing,'#pricing'],[t.nav_download,'#download']] as [string,string][]).map(([l,h]) => (
                <a key={h} href={h} className="nlink">{l}</a>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <LangSwitcher lang={lang} setLang={setLang} />
              <Link href="/auth/login" style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(240,240,255,.48)', textDecoration: 'none', padding: '8px 15px', borderRadius: 9, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', transition: 'all .2s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.color='#f0f0ff'; e.currentTarget.style.borderColor='rgba(168,85,247,.3)' }}
                onMouseLeave={e => { e.currentTarget.style.color='rgba(240,240,255,.48)'; e.currentTarget.style.borderColor='rgba(255,255,255,.08)' }}>
                {t.nav_dashboard}
              </Link>
              <a href="/download" className="btn-g" style={{ fontSize: 13, padding: '9px 18px', borderRadius: 10 }}>{t.nav_dl_btn}</a>
            </div>
          </div>
        </nav>

        {/* ── HERO ─────────────────────────────────────────────────────────────── */}
        <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: 66 }}>
          {/* Aurora background */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {/* Main purple aurora */}
            <div style={{ position: 'absolute', width: 900, height: 700, borderRadius: '50%', top: '-15%', left: '-10%', background: 'radial-gradient(ellipse, rgba(139,92,246,.22) 0%, rgba(168,85,247,.08) 40%, transparent 70%)', filter: 'blur(70px)', animation: 'blob-drift 18s ease-in-out infinite' }} />
            {/* Cyan accent */}
            <div style={{ position: 'absolute', width: 700, height: 600, borderRadius: '50%', top: '10%', right: '-12%', background: 'radial-gradient(ellipse, rgba(56,189,248,.18) 0%, rgba(6,182,212,.06) 45%, transparent 70%)', filter: 'blur(80px)', animation: 'blob-drift 22s ease-in-out infinite', animationDelay: '6s' }} />
            {/* Deep pink bottom */}
            <div style={{ position: 'absolute', width: 560, height: 560, borderRadius: '50%', bottom: '-10%', left: '35%', background: 'radial-gradient(ellipse, rgba(217,70,239,.14) 0%, transparent 65%)', filter: 'blur(90px)', animation: 'blob-drift 26s ease-in-out infinite', animationDelay: '12s' }} />
            {/* Center text glow */}
            <div style={{ position: 'absolute', width: 680, height: 480, top: '20%', left: '0%', background: 'radial-gradient(ellipse at 35% 40%, rgba(168,85,247,.11) 0%, transparent 60%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
          </div>

          <div className="wrap" style={{ position: 'relative', zIndex: 2, width: '100%', padding: '80px 24px' }}>
            <div className="hgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>

              {/* ── Left: Text ── */}
              <motion.div className="htxt" style={{ x: heroLeftX, y: heroLeftY }}>

                {/* Badge */}
                <motion.div variants={fadeUp} initial="hidden" animate="show"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(168,85,247,.06)', border: '1px solid rgba(168,85,247,.2)', borderRadius: 100, padding: '5px 16px 5px 8px', fontSize: 12, fontWeight: 600, color: 'rgba(240,240,255,.6)', marginBottom: 32, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: '0 2px 16px rgba(168,85,247,.1)' }}>
                  <span style={{ position: 'relative', display: 'inline-flex' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', display: 'inline-block' }} />
                    <span style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: '#a855f7', animation: 'pulse-ring 1.8s ease-out infinite' }} />
                  </span>
                  v{VERSION} · {t.hero_badge}
                </motion.div>

                {/* Headline */}
                <motion.h1 variants={fadeUpDelay(0.07)} initial="hidden" animate="show"
                  style={{ marginBottom: 24, letterSpacing: '-.03em', lineHeight: 1.05 }}>
                  <span style={{ display: 'block', fontSize: 'clamp(36px,4.8vw,66px)', fontWeight: 300, color: 'rgba(240,240,255,.85)' }}>{t.hero_h1a}</span>
                  <span className="gt" style={{ display: 'block', fontSize: 'clamp(46px,6.2vw,88px)', fontWeight: 900, lineHeight: 1.0 }}>{t.hero_h1b}</span>
                </motion.h1>

                {/* Subline */}
                <motion.p variants={fadeUpDelay(0.14)} initial="hidden" animate="show"
                  style={{ fontSize: 16.5, color: 'rgba(240,240,255,.4)', lineHeight: 1.9, marginBottom: 40, maxWidth: 460 }}>
                  {t.hero_sub}
                </motion.p>

                {/* CTAs */}
                <motion.div className="hbtns" variants={fadeUpDelay(0.2)} initial="hidden" animate="show"
                  style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 48 }}>
                  <a href="/download" className="btn-g" style={{ fontSize: 14.5, padding: '13px 28px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    {t.hero_cta}
                  </a>
                  <a href="#pricing" className="btn-o" style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', background: 'rgba(255,255,255,.04)' }}>{t.hero_cta2}</a>
                </motion.div>

                {/* Stats — glass cards */}
                <motion.div className="hstat" variants={fadeUpDelay(0.28)} initial="hidden" animate="show"
                  style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { ref: c1.ref, val: c1.val, suffix: '+', label: t.stat1l, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,.7)" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
                    { ref: c2.ref, val: c2.val >= 1000 ? Math.floor(c2.val / 1000) : c2.val, suffix: c2.val >= 1000 ? 'K+' : '+', label: t.stat2l, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(56,189,248,.7)" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                    { ref: c3.ref, val: c3.val, suffix: `.${String(VERSION).split('.')[2]}`, label: t.stat3l, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(217,70,239,.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'linear-gradient(135deg, rgba(255,255,255,.07), rgba(255,255,255,.02))', border: '1px solid rgba(255,255,255,.09)', borderRadius: 16, padding: '14px 20px', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', boxShadow: '0 4px 20px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.07)', minWidth: 100 }}>
                      <div style={{ marginBottom: 6 }}>{s.icon}</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: '#f0f0ff', letterSpacing: '-.04em', lineHeight: 1 }}>
                        <span ref={s.ref}>{s.val}</span>{s.suffix}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(240,240,255,.3)', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                    </div>
                  ))}
                </motion.div>
              </motion.div>

              {/* ── Right: App mockup ── */}
              <motion.div
                className="appwin"
                style={{ x: heroRightX, y: heroRightY, position: 'relative', padding: '50px 24px 50px 14px' }}
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
              >
                {/* Deep glow halo */}
                <div style={{ position: 'absolute', inset: -60, background: 'radial-gradient(ellipse 80% 70% at 55% 48%, rgba(139,92,246,.28) 0%, rgba(56,189,248,.14) 50%, transparent 70%)', pointerEvents: 'none', filter: 'blur(28px)' }} />

                {/* Ghost panel behind for depth */}
                <div style={{ position: 'absolute', top: 66, left: -6, right: 16, bottom: 58, background: 'rgba(139,92,246,.04)', border: '1px solid rgba(168,85,247,.1)', borderRadius: 26, backdropFilter: 'blur(6px)', zIndex: 4 }} />

                {/* Floating pill — Telegram top-right */}
                <motion.div
                  initial={{ opacity: 0, x: 28, y: -10 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.55, ease: 'easeOut' }}
                  style={{ position: 'absolute', top: 2, right: -8, zIndex: 22, background: 'rgba(6,6,15,.94)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(42,171,238,.28)', borderRadius: 18, padding: '11px 14px', width: 210, boxShadow: '0 16px 50px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.03)', animation: 'float2 6.5s ease-in-out infinite', animationDelay: '0s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#2AABEE,#1a8fd1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(42,171,238,.45)', overflow: 'hidden' }}>
                      <img src="/messengers/telegram.png" alt="Telegram" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#f0f0ff' }}>Telegram</div>
                      <div style={{ fontSize: 9.5, color: 'rgba(240,240,255,.25)' }}>только что</div>
                    </div>
                    <div style={{ background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 8, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>5</div>
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(240,240,255,.42)', lineHeight: 1.5 }}>Алексей: Договорились, до встречи! ✓</p>
                </motion.div>

                {/* Floating pill — WhatsApp bottom-right */}
                <motion.div
                  initial={{ opacity: 0, x: 20, y: 10 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 1.4, duration: 0.55, ease: 'easeOut' }}
                  style={{ position: 'absolute', bottom: 8, right: -14, zIndex: 22, background: 'rgba(6,6,15,.94)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(37,211,102,.25)', borderRadius: 18, padding: '11px 14px', width: 198, boxShadow: '0 16px 50px rgba(0,0,0,.7)', animation: 'float2 7.5s ease-in-out infinite', animationDelay: '3s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#25D366,#18a04c)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(37,211,102,.35)', overflow: 'hidden' }}>
                      <img src="/messengers/whatsapp.png" alt="WhatsApp" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#f0f0ff' }}>WhatsApp</div>
                      <div style={{ fontSize: 9.5, color: 'rgba(240,240,255,.25)' }}>2 мин назад</div>
                    </div>
                    <div style={{ background: '#25D366', color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 8, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>2</div>
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(240,240,255,.42)', lineHeight: 1.5 }}>Маша: Спасибо за помощь 🙏</p>
                </motion.div>

                {/* Floating pill — Discord top-left */}
                <motion.div
                  initial={{ opacity: 0, x: -20, y: -10 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 1.1, duration: 0.55, ease: 'easeOut' }}
                  style={{ position: 'absolute', top: 6, left: -20, zIndex: 22, background: 'rgba(6,6,15,.94)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(88,101,242,.28)', borderRadius: 18, padding: '10px 13px', width: 192, boxShadow: '0 16px 50px rgba(0,0,0,.65)', animation: 'float2 8s ease-in-out infinite', animationDelay: '1.5s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#5865F2,#4752c4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: '0 4px 12px rgba(88,101,242,.45)' }}>
                      {MessengerSvgs.discord && <svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#f0f0ff' }}>Discord · #general</div>
                      <div style={{ fontSize: 10, color: 'rgba(240,240,255,.35)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>Релиз v2.1 готов 🚀</div>
                    </div>
                  </div>
                </motion.div>

                {/* Messenger icon cluster — left side */}
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.8, duration: 0.5, ease: 'easeOut' }}
                  style={{ position: 'absolute', left: -38, top: '50%', transform: 'translateY(-50%)', zIndex: 22, display: 'flex', flexDirection: 'column', gap: 8, animation: 'float2 9s ease-in-out infinite', animationDelay: '4s' }}>
                  {([
                    { bg: 'linear-gradient(135deg,#7360F2,#5a4fd1)', icon: <svg viewBox="0 0 24 24" fill="white" width="14" height="14"><path d="M11.4 0C6.64.02 2.12 2.35 1.1 7.28c-.47 2.27-.41 4.76.11 7 .88 3.77 4.23 6.63 7.98 7.38.69.14 1.4.22 2.1.22H11c.48 0 .97-.03 1.45-.08l2.93 2.93c.1.1.22.14.36.14.27 0 .5-.22.5-.5v-3.48c2.7-1.17 4.66-3.52 5.28-6.3.54-2.42.38-5.15-.2-7.3C20.04 2.67 16.36-.02 11.4 0z"/></svg>, sh: 'rgba(115,96,242,.4)', label: 'Viber' },
                    { bg: 'linear-gradient(135deg,#EA4335,#c23321)', icon: <svg viewBox="0 0 24 24" fill="white" width="14" height="14"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.908 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>, sh: 'rgba(234,67,53,.4)', label: 'Gmail' },
                    { bg: 'linear-gradient(135deg,#0077FF,#0055cc)', icon: <svg viewBox="0 0 24 24" fill="white" width="14" height="14"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.169.508.271.508.22 0 .407-.136.813-.542 1.253-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/></svg>, sh: 'rgba(0,119,255,.4)', label: 'VK' },
                  ] as {bg:string;icon:React.ReactNode;sh:string;label:string}[]).map((m, i) => (
                    <div key={i} style={{ width: 36, height: 36, borderRadius: 11, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${m.sh}, 0 0 0 1px rgba(255,255,255,.08)`, flexShrink: 0 }} title={m.label}>
                      {m.icon}
                    </div>
                  ))}
                </motion.div>

                {/* Main window */}
                <div style={{ position: 'relative', zIndex: 10, background: 'linear-gradient(160deg, rgba(11,9,26,.99) 0%, rgba(6,6,15,.99) 100%)', border: '1px solid rgba(168,85,247,.22)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,.04), 0 52px 130px rgba(0,0,0,.92), 0 0 100px rgba(139,92,246,.16)', transform: 'perspective(1200px) rotateY(-4deg) rotateX(1.5deg)' }}>

                  {/* Titlebar */}
                  <div style={{ background: 'rgba(0,0,0,.6)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {([['#ef4444','rgba(239,68,68,.5)'],['#f59e0b','rgba(245,158,11,.5)'],['#22c55e','rgba(34,197,94,.5)']] as [string,string][]).map(([c,g]) => (
                        <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, boxShadow: `0 0 8px ${g}` }} />
                      ))}
                    </div>
                    {/* Search bar */}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                      <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 7, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6, width: 170 }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.18)', fontWeight: 500 }}>Поиск...</span>
                      </div>
                    </div>
                    <div style={{ width: 48 }} />
                  </div>

                  <div style={{ display: 'flex', height: 362 }}>

                    {/* Icon sidebar */}
                    <div style={{ width: 52, background: 'rgba(0,0,0,.42)', borderRight: '1px solid rgba(255,255,255,.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 8, flexShrink: 0 }}>
                      {([
                        {bg:'linear-gradient(145deg,#2AABEE,#1a8fd1)',sh:'rgba(42,171,238,.45)',l:'T',b:3,a:true},
                        {bg:'linear-gradient(145deg,#25D366,#18a04c)',sh:'rgba(37,211,102,.3)',l:'W',b:7,a:false},
                        {bg:'linear-gradient(145deg,#5865F2,#4752c4)',sh:'rgba(88,101,242,.35)',l:'D',b:0,a:false},
                        {bg:'linear-gradient(145deg,#0077FF,#0055cc)',sh:'rgba(0,119,255,.3)',l:'V',b:2,a:false},
                        {bg:'linear-gradient(145deg,#C13584,#833ab4)',sh:'rgba(193,53,132,.3)',l:'I',b:0,a:false},
                      ] as {bg:string;sh:string;l:string;b:number;a:boolean}[]).map((m,i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <div style={{ width: 34, height: 34, borderRadius: m.a ? 10 : 17, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff', boxShadow: `0 4px 16px ${m.sh}`, outline: m.a ? '2px solid rgba(168,85,247,.8)' : 'none', outlineOffset: 2 }}>{m.l}</div>
                          {m.b > 0 && <div style={{ position: 'absolute', top: -4, right: -5, width: 15, height: 15, borderRadius: 8, background: '#ef4444', fontSize: 8, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #06060f', boxShadow: '0 0 10px rgba(239,68,68,.6)' }}>{m.b}</div>}
                        </div>
                      ))}
                      <div style={{ flex: 1 }} />
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(168,85,247,.08)', border: '1px dashed rgba(168,85,247,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: 'rgba(168,85,247,.5)', lineHeight: 1 }}>+</div>
                    </div>

                    {/* Chat list */}
                    <div style={{ width: 154, borderRight: '1px solid rgba(255,255,255,.04)', background: 'rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                      <div style={{ padding: '9px 12px 7px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(240,240,255,.75)', letterSpacing: '-.01em' }}>Telegram</div>
                      </div>
                      {([
                        { name: 'Алексей М.', msg: 'Хорошо, до встречи!', time: '10:27', unread: 0, active: true },
                        { name: 'Команда Dev', msg: 'Новый релиз готов 🚀', time: '09:45', unread: 3, active: false },
                        { name: 'Маша К.', msg: 'Спасибо большое!', time: 'вчера', unread: 0, active: false },
                        { name: 'Дизайн', msg: 'Макет обновлён', time: 'вчера', unread: 1, active: false },
                        { name: 'Поддержка', msg: 'Тикет закрыт ✓', time: 'вчера', unread: 0, active: false },
                      ] as {name:string;msg:string;time:string;unread:number;active:boolean}[]).map((chat, i) => (
                        <div key={i} style={{ padding: '8px 12px', background: chat.active ? 'rgba(168,85,247,.12)' : 'transparent', borderLeft: chat.active ? '2px solid rgba(168,85,247,.65)' : '2px solid transparent' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: chat.active ? '#f0f0ff' : 'rgba(240,240,255,.6)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 88 }}>{chat.name}</div>
                            <div style={{ fontSize: 9, color: 'rgba(240,240,255,.22)', flexShrink: 0 }}>{chat.time}</div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 10, color: 'rgba(240,240,255,.28)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 96 }}>{chat.msg}</div>
                            {chat.unread > 0 && <div style={{ width: 15, height: 15, borderRadius: 8, background: '#a855f7', fontSize: 8.5, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{chat.unread}</div>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Chat area */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      {/* Chat header */}
                      <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.2)' }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#2AABEE,#1a8fd1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: '0 3px 10px rgba(42,171,238,.4)' }}>А</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#f0f0ff', lineHeight: 1.2 }}>Алексей М.</div>
                          <div style={{ fontSize: 9.5, color: '#22c55e', fontWeight: 600 }}>● онлайн</div>
                        </div>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                      </div>

                      {/* Messages */}
                      <div style={{ flex: 1, padding: '10px 11px 6px', display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'hidden' }}>
                        {([
                          {r:false,t:'Привет! Как насчёт встречи?',ts:'10:24'},
                          {r:true,t:'Да, давай в 15:00 🕒',ts:'10:25'},
                          {r:false,t:'Окей! У офиса 📍',ts:'10:26'},
                          {r:true,t:'Договорились ✓✓',ts:'10:27'},
                        ] as {r:boolean;t:string;ts:string}[]).map((m,i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: m.r ? 'flex-end' : 'flex-start' }}>
                            <div style={{ background: m.r ? 'linear-gradient(135deg,rgba(139,92,246,.92),rgba(56,189,248,.75))' : 'rgba(255,255,255,.055)', border: m.r ? '1px solid rgba(139,92,246,.4)' : '1px solid rgba(255,255,255,.06)', borderRadius: m.r ? '13px 13px 3px 13px' : '13px 13px 13px 3px', padding: '7px 11px', fontSize: 10.5, color: 'rgba(240,240,255,.92)', maxWidth: 160, lineHeight: 1.5, boxShadow: m.r ? '0 4px 20px rgba(139,92,246,.35)' : 'none' }}>
                              <div>{m.t}</div>
                              <div style={{ fontSize: 9, color: m.r ? 'rgba(255,255,255,.38)' : 'rgba(240,240,255,.2)', marginTop: 2, textAlign: 'right' }}>{m.ts}</div>
                            </div>
                          </div>
                        ))}
                        {/* Typing indicator */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#2AABEE,#1a8fd1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontWeight: 900, color: '#fff', flexShrink: 0 }}>А</div>
                          <div style={{ background: 'rgba(255,255,255,.055)', border: '1px solid rgba(255,255,255,.06)', borderRadius: '12px 12px 12px 3px', padding: '9px 13px', display: 'flex', gap: 3, alignItems: 'center' }}>
                            {[0, 0.22, 0.44].map((delay, i) => (
                              <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(240,240,255,.45)', display: 'inline-block', animation: `typing-dot 1.3s ease-in-out ${delay}s infinite` }} />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Input */}
                      <div style={{ padding: '7px 10px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,.26)' }}>
                        <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, flex: 1, padding: '7px 11px', fontSize: 10.5, color: 'rgba(240,240,255,.14)' }}>Написать сообщение...</div>
                        <div style={{ width: 27, height: 27, borderRadius: '50%', background: 'linear-gradient(135deg,#d946ef,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 18px rgba(168,85,247,.55)', flexShrink: 0 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Online badge — bottom left */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5, duration: 0.5, ease: 'easeOut' }}
                  style={{ position: 'absolute', bottom: 16, left: -20, zIndex: 22, background: 'rgba(6,6,15,.92)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 50, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 32px rgba(0,0,0,.6)', animation: 'float2 7s ease-in-out infinite', animationDelay: '2s' }}>
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e', display: 'inline-block' }} />
                    <span style={{ position: 'absolute', width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse-ring 1.6s ease-out infinite' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap' }}>7 сервисов онлайн</span>
                </motion.div>

              </motion.div>
            </div>
          </div>
        </section>

        <div className="hr" />

        {/* ── MESSENGERS ───────────────────────────────────────────────────────── */}
        <section id="messengers" style={{ padding: '80px 0' }}>
          <div className="wrap" style={{ textAlign: 'center', marginBottom: 48 }}>
            <motion.div className="stag" style={{ justifyContent: 'center' }} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>{t.ms_label}</motion.div>
            <motion.h2 variants={fadeUpDelay(0.08)} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ fontSize: 'clamp(24px,3.5vw,42px)', fontWeight: 800, color: '#f0f0ff', letterSpacing: '-.025em' }}>{t.ms_title}</motion.h2>
            <motion.p variants={fadeUpDelay(0.16)} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ color: 'rgba(240,240,255,.35)', fontSize: 15, marginTop: 10 }}>{t.ms_sub}</motion.p>
          </div>
          <div className="mq-wrap">
            <div className="mq-track">
              {[...Array(2)].flatMap((_, rep) =>
                messengers.map((m, i) => (
                  <div key={`${rep}-${i}`} className="mc">
                    <div style={{ width: 48, height: 48, borderRadius: 13, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', boxShadow: `0 6px 20px ${m.color}55` }}>
                      {m.img ? <img src={m.img} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : MessengerSvgs[m.svg!]}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(240,240,255,.45)', whiteSpace: 'nowrap', textAlign: 'center' }}>{m.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <div className="hr" />

        {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
        <section id="features" className="sec">
          <div className="wrap">
            <div style={{ textAlign: 'center', marginBottom: 68 }}>
              <motion.div className="stag" style={{ justifyContent: 'center' }} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>{t.feat_label}</motion.div>
              <motion.h2 className="sh" variants={fadeUpDelay(0.08)} initial="hidden" whileInView="show" viewport={{ once: true }}>{t.feat_title}<br /><span className="gt">{t.feat_title2}</span></motion.h2>
              <motion.p className="sp" variants={fadeUpDelay(0.16)} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ maxWidth: 500, margin: '14px auto 0' }}>{t.feat_sub}</motion.p>
            </div>
            <div className="fgrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {features.map((f, i) => (
                <motion.div key={i} className="gc" style={{ padding: '28px' }} variants={fadeUpDelay(i * 0.07)} initial="hidden" whileInView="show" viewport={{ once: true }} whileHover={{ y: -5 }}>
                  <div className="fi"><FeatureIcon name={f.icon} /></div>
                  <h3 style={{ fontSize: 15.5, fontWeight: 700, color: '#f0f0ff', marginBottom: 9, letterSpacing: '-.015em' }}>{f.title}</h3>
                  <p style={{ fontSize: 13.5, color: 'rgba(240,240,255,.36)', lineHeight: 1.8 }}>{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <div className="hr" />

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
        <section style={{ padding: '100px 0', background: 'linear-gradient(180deg, rgba(168,85,247,.03) 0%, transparent 100%)' }}>
          <div className="wrap">
            <div style={{ textAlign: 'center', marginBottom: 68 }}>
              <motion.div className="stag" style={{ justifyContent: 'center' }} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>{t.how_label}</motion.div>
              <motion.h2 className="sh" variants={fadeUpDelay(0.08)} initial="hidden" whileInView="show" viewport={{ once: true }}>{t.how_title}<span className="gt">{t.how_title2}</span></motion.h2>
            </div>
            <div className="sgrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 48, position: 'relative' }}>
              {[
                { n:'01', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>, title: t.step1t, desc: t.step1d },
                { n:'02', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>, title: t.step2t, desc: t.step2d },
                { n:'03', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>, title: t.step3t, desc: t.step3d },
              ].map((s, i) => (
                <motion.div key={i} style={{ textAlign: 'center', position: 'relative' }} variants={fadeUpDelay(i * 0.12)} initial="hidden" whileInView="show" viewport={{ once: true }}>
                  {i < 2 && <div className="sconn" />}
                  <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,.02) 100%)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 22, padding: '32px 28px', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', boxShadow: '0 4px 24px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.06)', position: 'relative', zIndex: 1 }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto 22px', background: 'linear-gradient(135deg, rgba(217,70,239,.15), rgba(56,189,248,.1))', border: '1px solid rgba(168,85,247,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 32px rgba(168,85,247,.15)' }}>{s.icon}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', color: 'rgba(192,132,252,.5)', marginBottom: 10 }}>{s.n}</div>
                    <h3 style={{ fontSize: 19, fontWeight: 700, color: '#f0f0ff', marginBottom: 10, letterSpacing: '-.02em' }}>{s.title}</h3>
                    <p style={{ fontSize: 13.5, color: 'rgba(240,240,255,.36)', lineHeight: 1.8 }}>{s.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CLOUD SYNC ───────────────────────────────────────────────────────── */}
        <section className="sec">
          <div className="wrap">
            <div className="cgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
              <motion.div style={{ position: 'relative' }} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
                <div style={{ position: 'absolute', inset: -60, background: 'radial-gradient(ellipse at 40% 50%, rgba(168,85,247,.1), transparent 65%)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <div className="gc" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(168,85,247,.07)', borderColor: 'rgba(168,85,247,.2)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#d946ef,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 24px rgba(168,85,247,.35)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#f0f0ff', fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Синхронизация активна</div>
                      <div style={{ color: 'rgba(240,240,255,.35)', fontSize: 12.5 }}>Последняя синхронизация: только что</div>
                    </div>
                    <div style={{ position: 'relative', display: 'inline-flex' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 12px #22c55e', display: 'inline-block' }} />
                      <span style={{ position: 'absolute', width: 9, height: 9, borderRadius: '50%', background: '#22c55e', animation: 'pulse-ring 2s ease-out infinite' }} />
                    </div>
                  </div>
                  {[
                    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>, txt: '7 мессенджеров синхронизировано' },
                    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>, txt: '3 папки и настройки сохранены' },
                    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>, txt: 'Тема и интерфейс перенесены' },
                    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, txt: 'Настройки уведомлений обновлены' },
                  ].map((item, i) => (
                    <div key={i} className="gc" style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      {item.icon}
                      <span style={{ fontSize: 13.5, color: 'rgba(240,240,255,.48)', flex: 1 }}>{item.txt}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  ))}
                </div>
              </motion.div>
              <motion.div variants={fadeUpDelay(0.16)} initial="hidden" whileInView="show" viewport={{ once: true }}>
                <div className="stag">{t.cloud_label}</div>
                <h2 className="sh">{t.cloud_title}<span className="gt">{t.cloud_title2}</span></h2>
                <p className="sp">{t.cloud_sub}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 32 }}>
                  {[t.cloud_f1, t.cloud_f2, t.cloud_f3, t.cloud_f4].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="cc"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                      <span style={{ fontSize: 15, color: 'rgba(240,240,255,.52)' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <div className="hr" />

        {/* ── PRICING ──────────────────────────────────────────────────────────── */}
        <section id="pricing" className="sec" style={{ position: 'relative' }}>
          <div className="wrap" style={{ position: 'relative' }}>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <motion.div className="stag" style={{ justifyContent: 'center' }} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>{t.pr_label}</motion.div>
              <motion.h2 className="sh" variants={fadeUpDelay(0.08)} initial="hidden" whileInView="show" viewport={{ once: true }}>{t.pr_title}</motion.h2>
              <motion.p className="sp" variants={fadeUpDelay(0.16)} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ maxWidth: 460, margin: '14px auto 0' }}>{t.pr_sub}</motion.p>
            </div>

            <motion.div variants={fadeUpDelay(0.1)} initial="hidden" whileInView="show" viewport={{ once: true }}
              style={{ position: 'relative', padding: '32px 0 20px' }}>
              <GlassPricingSection
                title={null}
                subtitle={null}
                showAnimatedBackground={true}
                plans={[
                  {
                    planName: t.plan_free,
                    description: t.plan_free_sub,
                    price: '0 ₽',
                    features: t.feat_items_free as string[],
                    disabledFeatures: t.feat_items_no as string[],
                    buttonText: t.plan_free_btn,
                    buttonHref: '/download',
                    buttonVariant: 'secondary',
                  } satisfies PricingCardProps,
                  {
                    planName: t.plan_month,
                    description: t.plan_month_sub,
                    price: '199 ₽',
                    period: '/мес',
                    features: t.feat_items_pro as string[],
                    disabledFeatures: t.feat_items_pro_no as string[],
                    buttonText: t.plan_month_btn,
                    buttonHref: '/auth/login',
                    buttonVariant: 'secondary',
                  } satisfies PricingCardProps,
                  {
                    planName: t.plan_year,
                    description: '1 590 ₽/год · экономия 33%',
                    price: '133 ₽',
                    period: '/мес',
                    features: t.feat_items_pro_year as string[],
                    badge: t.plan_year_badge,
                    savingsBadge: t.plan_year_save,
                    buttonText: t.plan_year_btn,
                    buttonHref: '/auth/login',
                    isPopular: true,
                    buttonVariant: 'primary',
                  } satisfies PricingCardProps,
                ]}
                note={
                  <div style={{ fontSize: 12.5, color: 'rgba(240,240,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>{t.pay_secure}</span><span style={{ opacity: .3 }}>·</span>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>{t.pay_cards}</span><span style={{ opacity: .3 }}>·</span>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>{t.pay_instant}</span><span style={{ opacity: .3 }}>·</span>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>{t.pay_cancel}</span>
                  </div>
                }
              />
            </motion.div>
          </div>
        </section>

        <div className="hr" />

        {/* ── DOWNLOAD ─────────────────────────────────────────────────────────── */}
        <section id="download" className="sec" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', bottom: '-30%', left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(168,85,247,.12) 0%, transparent 70%)', filter: 'blur(90px)', pointerEvents: 'none' }} />
          <div className="wrap" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <motion.div className="stag" style={{ justifyContent: 'center' }} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>{t.dl_label}</motion.div>
            <motion.h2 className="sh" variants={fadeUpDelay(0.08)} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ marginBottom: 16 }}>{t.dl_title}</motion.h2>
            <motion.p className="sp" variants={fadeUpDelay(0.16)} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ maxWidth: 460, margin: '0 auto 52px' }}>{t.dl_sub}</motion.p>
            <motion.div className="dlwrap" variants={fadeUpDelay(0.24)} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
              {[
                { os: t.os_win, sub: t.dl_win_sub, href: '/download/windows', icon: OsIcons.windows, color: '#60a5fa' },
                { os: t.os_mac, sub: t.dl_mac_sub, href: '/download/macos', icon: OsIcons.macos, color: '#c084fc' },
                { os: t.os_lin, sub: t.dl_lin_sub, href: '/download/linux', icon: OsIcons.linux, color: '#fb923c' },
              ].map(p => (
                <a key={p.os} href={p.href} className="osc" style={{ color: '#f0f0ff' }}>
                  <div style={{ color: p.color, marginBottom: 4 }}>{p.icon}</div>
                  <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.015em' }}>{p.os}</span>
                  <span style={{ fontSize: 11.5, color: 'rgba(240,240,255,.3)' }}>{p.sub}</span>
                </a>
              ))}
            </motion.div>
            <p style={{ fontSize: 12.5, color: 'rgba(240,240,255,.16)' }}>v{VERSION} · Бесплатно</p>
          </div>
        </section>

        {/* ── CTA BANNER ───────────────────────────────────────────────────────── */}
        <section style={{ padding: '0 0 80px' }}>
          <div className="wrap">
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ position: 'relative', background: 'linear-gradient(135deg, rgba(168,85,247,.09) 0%, rgba(88,56,198,.06) 50%, rgba(56,189,248,.07) 100%)', border: '1px solid rgba(168,85,247,.17)', borderRadius: 24, padding: '56px 64px', textAlign: 'center', overflow: 'hidden', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.045) 1px, transparent 1px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(168,85,247,.14) 0%, transparent 70%)', filter: 'blur(70px)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative' }}>
                <h2 style={{ fontSize: 'clamp(22px,3.5vw,40px)', fontWeight: 900, color: '#f0f0ff', letterSpacing: '-.03em', marginBottom: 14 }}>
                  Готов попробовать <span className="gt">Centrio</span>?
                </h2>
                <p style={{ fontSize: 16, color: 'rgba(240,240,255,.4)', marginBottom: 36, maxWidth: 460, margin: '0 auto 36px' }}>Скачай бесплатно и объедини все мессенджеры в одном окне.</p>
                <a href="/download" className="btn-g" style={{ fontSize: 15, padding: '14px 36px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Скачать для Windows
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,.06)', position: 'relative', overflow: 'hidden' }}>
          <div className="wrap" style={{ padding: '56px 24px 40px' }}>
            <div className="ftcols" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>

              {/* Brand */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                  <img src="/logo.png" alt="Centrio" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                  <span style={{ fontWeight: 800, fontSize: 18, color: '#f0f0ff', letterSpacing: '-.025em' }}>Centrio</span>
                </div>
                <p style={{ fontSize: 13.5, color: 'rgba(240,240,255,.3)', lineHeight: 1.85, maxWidth: 256, marginBottom: 24 }}>Все мессенджеры в одном приложении. Удобно. Быстро. Безопасно.</p>
                <div style={{ display: 'flex', gap: 9 }}>
                  {[
                    { href: 'https://t.me/centrio_app', label: 'TG', svg: <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.04 9.607c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.903.614z"/></svg> },
                  ].map((s, i) => (
                    <a key={i} href={s.href} target="_blank" rel="noopener" style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(240,240,255,.38)', textDecoration: 'none', transition: 'all .2s' }}
                      onMouseEnter={e => { e.currentTarget.style.color='#f0f0ff'; e.currentTarget.style.borderColor='rgba(168,85,247,.35)'; e.currentTarget.style.background='rgba(168,85,247,.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.color='rgba(240,240,255,.38)'; e.currentTarget.style.borderColor='rgba(255,255,255,.08)'; e.currentTarget.style.background='rgba(255,255,255,.05)' }}>
                      {s.svg}
                    </a>
                  ))}
                </div>
              </div>

              {/* Product */}
              <div>
                <span className="flh">Продукт</span>
                <a href="#features" className="fl">{t.nav_features}</a>
                <a href="#messengers" className="fl">{t.nav_messengers}</a>
                <a href="#pricing" className="fl">{t.nav_pricing}</a>
                <Link href="/download/windows" className="fl">Windows</Link>
                <Link href="/download/macos" className="fl">macOS</Link>
                <Link href="/download/linux" className="fl">Linux</Link>
              </div>

              {/* Resources */}
              <div>
                <span className="flh">Ресурсы</span>
                <Link href="/faq" className="fl">{t.footer_faq}</Link>
                <Link href="/blog/top-apps" className="fl">Топ приложений</Link>
                <Link href="/blog/vs-rambox" className="fl">vs Rambox</Link>
                <Link href="/blog/vs-franz" className="fl">vs Franz</Link>
                <Link href="/blog/vs-wavebox" className="fl">vs Wavebox</Link>
              </div>

              {/* Support */}
              <div>
                <span className="flh">Поддержка</span>
                <Link href="/dashboard" className="fl">{t.nav_dashboard}</Link>
                <button onClick={() => setSupportOpen(true)} className="fl" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit', display: 'block', marginBottom: 9 }}>{t.footer_support}</button>
                <Link href="/privacy" className="fl">{t.footer_privacy}</Link>
                <Link href="/terms" className="fl">{t.footer_terms}</Link>
                <Link href="/refund" className="fl">Возврат</Link>
              </div>
            </div>

            <div style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 12, color: 'rgba(240,240,255,.17)', lineHeight: 1.9 }}>
                  © 2026 Centrio · v{VERSION} · ИП Козловский Артём Сергеевич · ИНН: 501908743800 · ОГРНИП: 326508100200742
                </p>
                <p style={{ fontSize: 12, color: 'rgba(240,240,255,.13)', marginTop: 3 }}>
                  Использование означает согласие с{' '}
                  <Link href="/terms" style={{ color: 'rgba(240,240,255,.26)', textDecoration: 'underline' }}>Условиями</Link>
                  {' '}и{' '}
                  <Link href="/privacy" style={{ color: 'rgba(240,240,255,.26)', textDecoration: 'underline' }}>Политикой конфиденциальности</Link>.
                </p>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(240,240,255,.14)', flexShrink: 0 }}>{t.footer_rights}</span>
            </div>
          </div>

        </footer>

      </div>
    </>
  )
}
