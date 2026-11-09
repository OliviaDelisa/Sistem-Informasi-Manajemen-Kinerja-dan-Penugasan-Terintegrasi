import Icon from './Icon'

export default function MetricCard({ label, value, note, icon, tone = 'green' }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon name={icon} size={19} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={tone === 'orange' ? 'warning' : ''}>{note}</small>
    </article>
  )
}
