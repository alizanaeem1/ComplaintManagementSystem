import { motion, useMotionTemplate, useMotionValue } from 'framer-motion'
import React, { useRef } from 'react'
import abdullahPic from '../assets/abdullah.jpg'
import fatimaPic from '../assets/fatima.jpg'
import alizaPic from '../assets/aliza.jpg'

const TEAM_MEMBERS = [
  {
    id: 1,
    name: 'Muhammad Abdullah',
    role: 'Super Admin & Lead Developer',
    description: 'Project architecture, full-stack integration, and team leadership.',
    image: abdullahPic,
    portfolioLink: 'https://muhammadabdullahwali.vercel.app/',
    accent: 'from-sky-500/40 to-cyan-500/20',
    ring: 'border-sky-400/50 shadow-[0_8px_40px_rgba(14,165,233,0.3)] group-hover:shadow-[0_20px_80px_rgba(14,165,233,0.6)] group-hover:border-sky-300/80',
    avatarBorder: 'border-sky-400',
    isLeader: true,
    spotlightColor: 'rgba(56, 189, 248, 0.4)',
    buttonGradient: 'from-sky-500 to-cyan-400'
  },
  {
    id: 2,
    name: 'Fatima Choudhry',
    role: 'Lead Developer',
    description: 'Frontend architecture, user experience design, and seamless animations.',
    image: fatimaPic,
    portfolioLink: 'https://fatimachouhrycv.vercel.app',
    accent: 'from-violet-500/30 to-fuchsia-500/20',
    ring: 'border-violet-400/50 shadow-[0_8px_40px_rgba(139,92,246,0.3)] group-hover:shadow-[0_20px_80px_rgba(139,92,246,0.6)] group-hover:border-violet-300/80',
    avatarBorder: 'border-violet-400',
    isLeader: false,
    spotlightColor: 'rgba(139, 92, 246, 0.4)',
    buttonGradient: 'from-violet-500 to-fuchsia-400'
  },
  {
    id: 3,
    name: 'Aliza Naeem',
    role: 'Lead Developer',
    description: 'Backend services, robust database design, and core API integrations.',
    image: alizaPic,
    portfolioLink: 'https://alizanaeemcv-zeta.vercel.app/',
    accent: 'from-emerald-500/30 to-teal-500/20',
    ring: 'border-emerald-400/50 shadow-[0_8px_40px_rgba(16,185,129,0.3)] group-hover:shadow-[0_20px_80px_rgba(16,185,129,0.6)] group-hover:border-emerald-300/80',
    avatarBorder: 'border-emerald-400',
    isLeader: false,
    spotlightColor: 'rgba(16, 185, 129, 0.4)',
    buttonGradient: 'from-emerald-500 to-teal-400'
  }
]

// Reusable Advanced Card component
function DeveloperCard({ member, index }) {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  function handleMouseMove({ currentTarget, clientX, clientY }) {
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        delay: index * 0.15,
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1]
      }}
      className="relative z-10 w-full"
    >
      {/* Ambient floating animation container */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: index * 0.4
        }}
        className="h-full"
      >
        <motion.div
          whileHover="hover"
          variants={{
            hover: { scale: 1.05, y: -5 }
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          onMouseMove={handleMouseMove}
          className={`group relative flex h-full flex-col items-center text-center rounded-[2rem] border bg-[#0f172a]/70 backdrop-blur-3xl p-8 overflow-hidden transition-all duration-500 ${member.ring} z-10 hover:z-20`}
        >
          {/* Dynamic Spotlight Effect following cursor */}
          <motion.div
            style={{
              background: useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, ${member.spotlightColor}, transparent 80%)`
            }}
            className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none mix-blend-screen"
          />

          {/* Light Sweep Highlight Animation */}
          <motion.div
            variants={{
              hover: {
                x: ['-100%', '200%'],
                transition: {
                  duration: 1.5,
                  ease: 'easeInOut',
                }
              }
            }}
            className="absolute inset-0 z-0 w-full -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none"
          />

          {/* Static Ambient Color Underlay */}
          <div
            className={`absolute inset-0 opacity-20 group-hover:opacity-50 transition-opacity duration-500 bg-gradient-to-br ${member.accent} z-0 pointer-events-none mix-blend-overlay`}
            aria-hidden
          />

          {/* Avatar and Glowing Backdrop */}
          <div className="relative mb-8 pt-4 z-10 duration-500 group-hover:scale-[1.12] group-hover:-translate-y-3">
            <div className={`absolute inset-0 rounded-full blur-2xl opacity-60 group-hover:opacity-100 bg-gradient-to-br transition-opacity duration-500 ${member.accent}`} />
            
            {/* Precise Relative Wrapper for Image and Badge */}
            <div className="relative w-40 h-40 mx-auto">
              <img
                src={member.image}
                alt={member.name}
                className={`relative z-10 w-full h-full rounded-full border-[8px] shadow-2xl object-cover bg-slate-900 transition-colors duration-500 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] ${member.avatarBorder}`}
                loading="lazy"
              />

              {/* Premium Role Badges Relocated to Bottom Right with Precise Alignment */}
              <motion.div 
                initial={{ scale: 0, rotate: 20 }}
                animate={{ scale: 1, rotate: 0 }}
                variants={{ hover: { y: [0, 5, 0], scale: 1.1 } }} 
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="absolute bottom-1 right-1 z-30"
              >
                {member.isLeader ? (
                  /* Super Admin Badge: Compact Diamond */
                  <div className={`bg-[#0f172a] p-1.5 rounded-full border-2 shadow-lg ${member.avatarBorder}`}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className={`w-[1.1rem] h-[1.1rem] drop-shadow-[0_0_8px_currentColor] opacity-90 ${member.avatarBorder.replace('border-', 'text-')}`}>
                      <path d="M12 2L4 12L12 22L20 12L12 2Z" />
                    </svg>
                  </div>
                ) : (
                  /* Lead Developer Badge: Compact Bolt */
                  <div className={`bg-[#0f172a] p-1.5 rounded-full border-2 shadow-lg ${member.avatarBorder}`}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className={`w-[1rem] h-[1rem] drop-shadow-[0_0_8px_currentColor] opacity-90 ${member.avatarBorder.replace('border-', 'text-')}`}>
                      <path d="M13 2L3 14H12V22L22 10H13V2Z" />
                    </svg>
                  </div>
                )}
              </motion.div>
            </div>
          </div>

          {/* Main Typography */}
          <h3 className="relative z-10 flex items-center justify-center gap-2 text-[1.65rem] font-bold text-white tracking-wide transition-colors duration-300 drop-shadow-md">
            {member.name}
          </h3>

          <div className="relative z-10 w-full mt-4 flex justify-center">
            <div className="inline-block px-6 py-2 rounded-full border border-[#0ea5e9]/40 bg-[#0c4a6e]/40 text-[#7dd3fc] text-[0.85rem] font-bold tracking-[0.12em] uppercase text-center shadow-[0_0_15px_rgba(14,165,233,0.15)] group-hover:border-[#0ea5e9]/60 group-hover:text-[#bae6fd] hover-transition">
              <span className="leading-[1.4] block">{member.role}</span>
            </div>
          </div>

          <p className="relative z-10 mt-6 mb-10 px-3 text-[1rem] leading-relaxed text-slate-400/90 group-hover:text-slate-200 transition-colors duration-300 flex-grow">
            {member.description}
          </p>

          {/* Premium Portfolio Button inside Card */}
          <motion.a
            href={member.portfolioLink}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`relative z-10 overflow-hidden w-full group/btn flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${member.buttonGradient} px-5 py-3.5 font-bold text-white shadow-lg transition-all duration-300 hover:shadow-[0_0_25px_var(--glow)]`}
            style={{ '--glow': member.spotlightColor }}
          >
            <span className="relative z-10 flex items-center gap-2 tracking-wide text-[0.95rem]">
              View Portfolio
              <motion.span
                className="inline-block"
                variants={{ hover: { x: [0, 5, 0] } }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-[1.1rem] h-[1.1rem]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </motion.span>
            </span>
            {/* Inner Button Shimmer Effect */}
            <motion.div
              variants={{
                hover: {
                  x: ['-150%', '250%'],
                  transition: {
                    duration: 1.5,
                    ease: 'easeInOut',
                    repeat: Infinity,
                    repeatDelay: 0.5
                  }
                }
              }}
              className="absolute inset-0 z-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover/btn:opacity-100 pointer-events-none blur-[1px]"
            />
          </motion.a>

        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export function DevelopmentTeamSection() {
  return (
    <section className="relative z-10 w-full max-w-7xl mx-auto px-4 pt-12 pb-32 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center mb-20"
      >
        <span className="inline-flex py-1.5 px-5 rounded-full border border-sky-500/30 bg-sky-500/10 text-xs font-bold uppercase tracking-[0.3em] text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.4)] mb-6 backdrop-blur-sm">
          Our Development Team
        </span>
        <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-[3.5rem] md:leading-tight drop-shadow-xl">
          Project Contributors
        </h2>
        <p className="mx-auto mt-7 max-w-2xl text-[1.1rem] text-slate-400 font-medium tracking-wide">
          Meet the developers who designed and engineered this system with innovation and precision.
        </p>
      </motion.div>

      {/* Grid: 1 Mobile, 2 Tablet, 3 Desktop */}
      <div className="mx-auto grid max-w-[72rem] grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3 items-stretch">
        {TEAM_MEMBERS.map((member, i) => (
          <DeveloperCard key={member.id} member={member} index={i} />
        ))}
      </div>
    </section>
  )
}
