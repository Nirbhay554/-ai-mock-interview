export default function InterviewLogo({ text = "INTERVIEW", size = "normal" }) {
  return (
    <div style={{
      display: 'inline-block',
      fontFamily: 'var(--font-display)',
      fontWeight: '900',
      fontSize: size === 'large' ? '28px' : '16px',
      color: '#000000',
      background: 'hsl(var(--secondary))',
      border: '3px solid #000000',
      padding: size === 'large' ? '12px 24px' : '6px 16px',
      borderRadius: '8px',
      boxShadow: '3px 3px 0px #000000',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      textAlign: 'center'
    }}>
      {text}
    </div>
  );
}
