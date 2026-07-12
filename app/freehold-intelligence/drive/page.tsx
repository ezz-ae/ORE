import { DraftsShelf } from '@/components/freehold/drive/drafts-shelf'
import { DriveRooms } from '@/components/freehold/drive/drive-rooms'

// Drive Home — a launcher of five rooms (Generative Studio · Media Editor · Web
// Designer · Files Manager · Cloud) with a "Continue editing" shelf on top. The
// actual files live in the Files Manager (/drive/library); this page is the map.
export default function DriveHomePage() {
  return (
    <>
      <DraftsShelf />
      <DriveRooms />
    </>
  )
}
