import { motion } from 'framer-motion';

export default function GlassCard({ children, className = '', hover = true, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`glass ${hover ? 'glass-hover' : ''} p-5 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
