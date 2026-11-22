/**
 * Reduit une photo avant envoi.
 *
 * Une photo d'iPhone 13 pese 2 a 4 Mo. Le modele n'a besoin que du
 * contenu visible : 1024 px suffisent pour reconnaitre des aliments,
 * et l'envoi passe de quelques megaoctets a environ 150 ko.
 */
export type PhotoPrete = {
  base64: string
  mimeType: string
  blob: Blob
  apercu: string
  largeur: number
  hauteur: number
}

export async function preparerPhoto(
  fichier: File,
  maxPx = 1024,
  qualite = 0.82,
): Promise<PhotoPrete> {
  // imageOrientation redresse les photos prises en portrait.
  const bitmap = await createImageBitmap(fichier, { imageOrientation: 'from-image' })

  const ratio = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height))
  const largeur = Math.max(1, Math.round(bitmap.width * ratio))
  const hauteur = Math.max(1, Math.round(bitmap.height * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("Le navigateur n'a pas pu préparer la photo.")
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Conversion de la photo impossible.'))),
      'image/jpeg',
      qualite,
    )
  })

  const base64 = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('Lecture de la photo impossible.'))
    fr.onload = () => {
      const s = String(fr.result)
      resolve(s.slice(s.indexOf(',') + 1)) // on enleve le prefixe data:
    }
    fr.readAsDataURL(blob)
  })

  return {
    base64,
    mimeType: 'image/jpeg',
    blob,
    apercu: URL.createObjectURL(blob),
    largeur,
    hauteur,
  }
}
