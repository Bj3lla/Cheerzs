import QRCode from 'qrcode'

export function useQrGenerator() {
  const generateQr = async (text: string): Promise<string> => {
    return await QRCode.toDataURL(text)
  }

  return { generateQr }
}
