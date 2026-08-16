import { useState } from 'react'
import type { Media } from '../data/schema.ts'
import { isLocalMedia, isVimeo, isYouTube } from '../data/schema.ts'
import { isVideoFile, mediaUrl } from '../data/media.ts'

type Props = {
  entryId: string
  media: Media[]
}

/**
 * Embedded players are click-to-load: the thumbnail is a plain image until you
 * ask for the video, so no third-party script runs on page load.
 */
function EmbeddedVideo({ src, poster, label }: { src: string; poster?: string; label: string }) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <iframe
        className="media__frame"
        src={`${src}?autoplay=1`}
        title={label}
        allow="accelerometer; autoplay; clipped-media; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }

  return (
    <button className="media__poster" type="button" onClick={() => setPlaying(true)}>
      {poster && <img src={poster} alt="" loading="lazy" />}
      <span className="media__play" aria-hidden="true">
        ▶
      </span>
      <span className="visually-hidden">Play {label}</span>
    </button>
  )
}

export default function MediaGallery({ entryId, media }: Props) {
  if (media.length === 0) return null

  return (
    <div className="media">
      {media.map((item, index) => {
        const caption = item.caption

        let content
        if (isLocalMedia(item)) {
          const url = mediaUrl(entryId, item.file)
          content = isVideoFile(item.file) ? (
            <video className="media__item" src={url} controls playsInline preload="metadata" />
          ) : (
            <img
              className="media__item"
              src={url}
              alt={item.alt ?? caption ?? ''}
              loading={index === 0 ? 'eager' : 'lazy'}
            />
          )
        } else if (isYouTube(item)) {
          content = (
            <EmbeddedVideo
              src={`https://www.youtube-nocookie.com/embed/${item.youtube}`}
              poster={`https://i.ytimg.com/vi/${item.youtube}/hqdefault.jpg`}
              label={caption ?? 'video'}
            />
          )
        } else if (isVimeo(item)) {
          content = (
            <EmbeddedVideo
              src={`https://player.vimeo.com/video/${item.vimeo}`}
              label={caption ?? 'video'}
            />
          )
        }

        return (
          <figure className="media__figure" key={index}>
            {content}
            {caption && <figcaption className="media__caption">{caption}</figcaption>}
          </figure>
        )
      })}
    </div>
  )
}
