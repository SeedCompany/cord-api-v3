import { FileNodeCategory } from './dto';

export const getCategoryFromMimeType = (mimeType: string) =>
  matchMimeType(mimeType)?.category ?? FileNodeCategory.Other;

export function matchMimeType(mimeType: string): MimeType | undefined {
  mimeType = mimeType.toLowerCase();
  return mimeTypes.find((me) => mimeType.startsWith(me.name));
}

interface MimeType {
  name: string;
  extensions: string[];
  category: FileNodeCategory;
}

/**
 * An adapted subset of values from
 * http://svn.apache.org/repos/asf/httpd/httpd/trunk/docs/conf/mime.types
 */
export const mimeTypes: MimeType[] = [
  {
    name: 'application/msword',
    extensions: ['doc', 'dot'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'application/pdf',
    extensions: ['pdf'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'application/postscript',
    extensions: ['ai', 'eps', 'ps'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'application/rtf',
    extensions: ['rtf'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'application/vnd.ms-excel',
    extensions: ['xls', 'xlm', 'xla', 'xlc', 'xlt', 'xlw'],
    category: FileNodeCategory.Spreadsheet,
  },
  {
    name: 'application/vnd.ms-outlook',
    extensions: ['msg', 'eml', 'mbox'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/octet-stream',
    extensions: ['msg', 'eml', 'mbox'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/vnd.ms-powerpoint',
    extensions: ['ppt', 'pps', 'pot'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/vnd.ms-project',
    extensions: ['mpp', 'mpt'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/vnd.oasis.opendocument.chart',
    extensions: ['odc'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/vnd.oasis.opendocument.chart-template',
    extensions: ['otc'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/vnd.oasis.opendocument.database',
    extensions: ['odb'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/vnd.oasis.opendocument.graphics',
    extensions: ['odg'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'application/vnd.oasis.opendocument.graphics-template',
    extensions: ['otg'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'application/vnd.oasis.opendocument.image',
    extensions: ['odi'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'application/vnd.oasis.opendocument.image-template',
    extensions: ['oti'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'application/vnd.oasis.opendocument.presentation',
    extensions: ['odp'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/vnd.oasis.opendocument.presentation-template',
    extensions: ['otp'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/vnd.oasis.opendocument.spreadsheet',
    extensions: ['ods'],
    category: FileNodeCategory.Spreadsheet,
  },
  {
    name: 'application/vnd.oasis.opendocument.spreadsheet-template',
    extensions: ['ots'],
    category: FileNodeCategory.Spreadsheet,
  },
  {
    name: 'application/vnd.oasis.opendocument.text',
    extensions: ['odt'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'application/vnd.oasis.opendocument.text-master',
    extensions: ['odm'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'application/vnd.oasis.opendocument.text-template',
    extensions: ['ott'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'application/vnd.oasis.opendocument.text-web',
    extensions: ['oth'],
    category: FileNodeCategory.Document,
  },
  {
    name:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['pptx'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/vnd.openxmlformats-officedocument.presentationml.slide',
    extensions: ['sldx'],
    category: FileNodeCategory.Other,
  },
  {
    name:
      'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
    extensions: ['ppsx'],
    category: FileNodeCategory.Other,
  },
  {
    name:
      'application/vnd.openxmlformats-officedocument.presentationml.template',
    extensions: ['potx'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['xlsx'],
    category: FileNodeCategory.Spreadsheet,
  },
  {
    name:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    extensions: ['xltx'],
    category: FileNodeCategory.Spreadsheet,
  },
  {
    name:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
    category: FileNodeCategory.Document,
  },
  {
    name:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
    extensions: ['dotx'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'application/vnd.visio',
    extensions: ['vsd', 'vst', 'vss', 'vsw'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/vnd.wordperfect',
    extensions: ['wpd'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'application/x-font-ghostscript',
    extensions: ['gsf'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'application/x-font-linux-psf',
    extensions: ['psf'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/x-font-pcf',
    extensions: ['pcf'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/x-font-snf',
    extensions: ['snf'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/x-font-type1',
    extensions: ['pfa', 'pfb', 'pfm', 'afm'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/x-gtar',
    extensions: ['gtar'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/x-iso9660-image',
    extensions: ['iso'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/x-ms-wmd',
    extensions: ['wmd'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'application/x-msaccess',
    extensions: ['mdb'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/x-mspublisher',
    extensions: ['pub'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/x-mswrite',
    extensions: ['wri'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'application/x-tar',
    extensions: ['tar'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/x-tex',
    extensions: ['tex'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'application/x-tex-tfm',
    extensions: ['tfm'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/x-texinfo',
    extensions: ['texinfo', 'texi'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'application/zip',
    extensions: ['zip'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'audio/adpcm',
    extensions: ['adp'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/basic',
    extensions: ['au', 'snd'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/midi',
    extensions: ['mid', 'midi', 'kar', 'rmi'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/mp4',
    extensions: ['m4a', 'mp4a'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/mpeg',
    extensions: ['mpga', 'mp2', 'mp2a', 'mp3', 'm2a', 'm3a'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/ogg',
    extensions: ['oga', 'ogg', 'spx'],
    category: FileNodeCategory.Audio,
  },
  { name: 'audio/s3m', extensions: ['s3m'], category: FileNodeCategory.Audio },
  { name: 'audio/silk', extensions: ['sil'], category: FileNodeCategory.Audio },
  {
    name: 'audio/vnd.rip',
    extensions: ['rip'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/webm',
    extensions: ['weba'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/x-aac',
    extensions: ['aac'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/x-aiff',
    extensions: ['aif', 'aiff', 'aifc'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/x-caf',
    extensions: ['caf'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/x-flac',
    extensions: ['flac'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/x-matroska',
    extensions: ['mka'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/x-mpegurl',
    extensions: ['m3u'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/x-ms-wax',
    extensions: ['wax'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/x-ms-wma',
    extensions: ['wma'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/x-pn-realaudio',
    extensions: ['ram', 'ra'],
    category: FileNodeCategory.Audio,
  },
  {
    name: 'audio/x-wav',
    extensions: ['wav'],
    category: FileNodeCategory.Audio,
  },
  { name: 'audio/xm', extensions: ['xm'], category: FileNodeCategory.Audio },
  { name: 'font/otf', extensions: ['otf'], category: FileNodeCategory.Other },
  { name: 'font/ttf', extensions: ['ttf'], category: FileNodeCategory.Other },
  { name: 'font/woff', extensions: ['woff'], category: FileNodeCategory.Other },
  {
    name: 'font/woff2',
    extensions: ['woff2'],
    category: FileNodeCategory.Other,
  },
  { name: 'image/bmp', extensions: ['bmp'], category: FileNodeCategory.Image },
  { name: 'image/cgm', extensions: ['cgm'], category: FileNodeCategory.Image },
  { name: 'image/g3fax', extensions: ['g3'], category: FileNodeCategory.Image },
  { name: 'image/gif', extensions: ['gif'], category: FileNodeCategory.Image },
  { name: 'image/ief', extensions: ['ief'], category: FileNodeCategory.Image },
  {
    name: 'image/jpeg',
    extensions: ['jpeg', 'jpg', 'jpe'],
    category: FileNodeCategory.Image,
  },
  { name: 'image/ktx', extensions: ['ktx'], category: FileNodeCategory.Image },
  { name: 'image/png', extensions: ['png'], category: FileNodeCategory.Image },
  { name: 'image/sgi', extensions: ['sgi'], category: FileNodeCategory.Image },
  {
    name: 'image/svg+xml',
    extensions: ['svg', 'svgz'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/tiff',
    extensions: ['tiff', 'tif'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/vnd.adobe.photoshop',
    extensions: ['psd'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/vnd.dwg',
    extensions: ['dwg'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'image/vnd.dxf',
    extensions: ['dxf'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'image/x-3ds',
    extensions: ['3ds'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'image/x-cmu-raster',
    extensions: ['ras'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-cmx',
    extensions: ['cmx'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-freehand',
    extensions: ['fh', 'fhc', 'fh4', 'fh5', 'fh7'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-icon',
    extensions: ['ico'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-mrsid-image',
    extensions: ['sid'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-pcx',
    extensions: ['pcx'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-pict',
    extensions: ['pic', 'pct'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-portable-anymap',
    extensions: ['pnm'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-portable-bitmap',
    extensions: ['pbm'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-portable-graymap',
    extensions: ['pgm'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-portable-pixmap',
    extensions: ['ppm'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-rgb',
    extensions: ['rgb'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-tga',
    extensions: ['tga'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-xbitmap',
    extensions: ['xbm'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-xpixmap',
    extensions: ['xpm'],
    category: FileNodeCategory.Image,
  },
  {
    name: 'image/x-xwindowdump',
    extensions: ['xwd'],
    category: FileNodeCategory.Other,
  },
  {
    name: 'text/calendar',
    extensions: ['ics', 'ifb'],
    category: FileNodeCategory.Other,
  },
  { name: 'text/css', extensions: ['css'], category: FileNodeCategory.Other },
  { name: 'text/csv', extensions: ['csv'], category: FileNodeCategory.Other },
  {
    name: 'text/html',
    extensions: ['html', 'htm'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'text/plain',
    extensions: ['txt', 'text', 'conf', 'def', 'list', 'log', 'in'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'text/richtext',
    extensions: ['rtx'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'text/sgml',
    extensions: ['sgml', 'sgm'],
    category: FileNodeCategory.Document,
  },
  {
    name: 'text/tab-separated-values',
    extensions: ['tsv'],
    category: FileNodeCategory.Other,
  },
  { name: 'video/3gpp', extensions: ['3gp'], category: FileNodeCategory.Video },
  {
    name: 'video/3gpp2',
    extensions: ['3g2'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/h261',
    extensions: ['h261'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/h263',
    extensions: ['h263'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/h264',
    extensions: ['h264'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/jpeg',
    extensions: ['jpgv'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/jpm',
    extensions: ['jpm', 'jpgm'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/mj2',
    extensions: ['mj2', 'mjp2'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/mp4',
    extensions: ['mp4', 'mp4v', 'mpg4'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/mpeg',
    extensions: ['mpeg', 'mpg', 'mpe', 'm1v', 'm2v'],
    category: FileNodeCategory.Video,
  },
  { name: 'video/ogg', extensions: ['ogv'], category: FileNodeCategory.Video },
  {
    name: 'video/quicktime',
    extensions: ['qt', 'mov'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/vnd.mpegurl',
    extensions: ['mxu', 'm4u'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/vnd.vivo',
    extensions: ['viv'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/webm',
    extensions: ['webm'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-f4v',
    extensions: ['f4v'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-fli',
    extensions: ['fli'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-flv',
    extensions: ['flv'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-m4v',
    extensions: ['m4v'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-matroska',
    extensions: ['mkv', 'mk3d', 'mks'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-mng',
    extensions: ['mng'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-ms-asf',
    extensions: ['asf', 'asx'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-ms-vob',
    extensions: ['vob'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-ms-wm',
    extensions: ['wm'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-ms-wmv',
    extensions: ['wmv'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-ms-wmx',
    extensions: ['wmx'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-ms-wvx',
    extensions: ['wvx'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-msvideo',
    extensions: ['avi'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-sgi-movie',
    extensions: ['movie'],
    category: FileNodeCategory.Video,
  },
  {
    name: 'video/x-smv',
    extensions: ['smv'],
    category: FileNodeCategory.Video,
  },
];
