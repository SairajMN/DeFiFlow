function Stat({ label, value }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
      <div className="text-sm text-gray-300">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}

export default Stat
