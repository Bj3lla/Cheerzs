type Props = {
  dataUrl: string
  label?: string
}

export function QrCodeDisplay({ dataUrl, label }: Props) {
  return (
    <div className="flex flex-col items-center">
      <img src={dataUrl} alt="QR Code" className="w-40 h-40" />
      {label && <p className="mt-2 text-sm text-gray-600">{label}</p>}
    </div>
  )
}
