export class MediaType {
  id: string;
  name: string;
  format: string;
  isHiddenByDefault: boolean;
  isSelected?: boolean;

  constructor(
    id: string = "",
    name: string = "",
    format: string = "",
    isHiddenByDefault: boolean = false,
  ) {
    this.id = id;
    this.name = name;
    this.format = format;
    this.isHiddenByDefault = isHiddenByDefault;
  }
}

export abstract class MediaConstants {

  static readonly VIDEO = new MediaType(
    "video",
    "Video",
    "video/mp4",
    false,
  );

  static readonly DOC = new MediaType(
    "document",
    "Document",
    "document/pdf",
    false,
  )

  static readonly PHOTO = new MediaType(
    "photo",
    "Photo",
    "image/jpeg",
    true,
  )

  static readonly AUDIO_TRACK = new MediaType(
    "audio-track",
    "Audio Track",
    "audio/mpeg",
    true,
  )

  static readonly PHOTO_ALBUM = new MediaType(
    "photo-album",
    "Photo Album",
    "collection/photo",
    false,
  )

  static readonly AUDIO_ALBUM = new MediaType(
    "audio-album",
    "Audio Album",
    "collection/audio",
    false,
  )

  static readonly ALL_TYPES = [
    MediaConstants.VIDEO,
    MediaConstants.DOC,
    MediaConstants.PHOTO,
    MediaConstants.AUDIO_TRACK,
    MediaConstants.PHOTO_ALBUM,
    MediaConstants.AUDIO_ALBUM,
  ]

}
