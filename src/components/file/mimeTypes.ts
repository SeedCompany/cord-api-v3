interface MimeType {
  name: string;
  extensions: string[];
}

/**
 * An adapted subset of values from
 * http://svn.apache.org/repos/asf/httpd/httpd/trunk/docs/conf/mime.types
 */
export const mimeTypes: MimeType[] = [
  {
    name: 'application/msword',
    extensions: ['doc', 'dot'],
  },
  {
    name: 'application/pdf',
    extensions: ['pdf'],
  },
  {
    name: 'application/postscript',
    extensions: ['ai', 'eps', 'ps'],
  },
  {
    name: 'application/rtf',
    extensions: ['rtf'],
  },
  {
    name: 'application/vnd.ms-excel',
    extensions: ['xls', 'xlm', 'xla', 'xlc', 'xlt', 'xlw'],
  },
  {
    name: 'application/vnd.ms-outlook',
    extensions: ['msg', 'eml', 'mbox'],
  },
  {
    name: 'application/octet-stream',
    extensions: ['msg', 'eml', 'mbox'],
  },
  {
    name: 'application/vnd.ms-powerpoint',
    extensions: ['ppt', 'pps', 'pot'],
  },
  {
    name: 'application/vnd.ms-project',
    extensions: ['mpp', 'mpt'],
  },
  {
    name: 'application/vnd.oasis.opendocument.chart',
    extensions: ['odc'],
  },
  {
    name: 'application/vnd.oasis.opendocument.chart-template',
    extensions: ['otc'],
  },
  {
    name: 'application/vnd.oasis.opendocument.database',
    extensions: ['odb'],
  },
  {
    name: 'application/vnd.oasis.opendocument.graphics',
    extensions: ['odg'],
  },
  {
    name: 'application/vnd.oasis.opendocument.graphics-template',
    extensions: ['otg'],
  },
  {
    name: 'application/vnd.oasis.opendocument.image',
    extensions: ['odi'],
  },
  {
    name: 'application/vnd.oasis.opendocument.image-template',
    extensions: ['oti'],
  },
  {
    name: 'application/vnd.oasis.opendocument.presentation',
    extensions: ['odp'],
  },
  {
    name: 'application/vnd.oasis.opendocument.presentation-template',
    extensions: ['otp'],
  },
  {
    name: 'application/vnd.oasis.opendocument.spreadsheet',
    extensions: ['ods'],
  },
  {
    name: 'application/vnd.oasis.opendocument.spreadsheet-template',
    extensions: ['ots'],
  },
  {
    name: 'application/vnd.oasis.opendocument.text',
    extensions: ['odt'],
  },
  {
    name: 'application/vnd.oasis.opendocument.text-master',
    extensions: ['odm'],
  },
  {
    name: 'application/vnd.oasis.opendocument.text-template',
    extensions: ['ott'],
  },
  {
    name: 'application/vnd.oasis.opendocument.text-web',
    extensions: ['oth'],
  },
  {
    name: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['pptx'],
  },
  {
    name: 'application/vnd.openxmlformats-officedocument.presentationml.slide',
    extensions: ['sldx'],
  },
  {
    name: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
    extensions: ['ppsx'],
  },
  {
    name: 'application/vnd.openxmlformats-officedocument.presentationml.template',
    extensions: ['potx'],
  },
  {
    name: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['xlsx'],
  },
  {
    name: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    extensions: ['xltx'],
  },
  {
    name: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
  },
  {
    name: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
    extensions: ['dotx'],
  },
  {
    name: 'application/vnd.visio',
    extensions: ['vsd', 'vst', 'vss', 'vsw'],
  },
  {
    name: 'application/vnd.wordperfect',
    extensions: ['wpd'],
  },
  {
    name: 'application/x-font-ghostscript',
    extensions: ['gsf'],
  },
  {
    name: 'application/x-font-linux-psf',
    extensions: ['psf'],
  },
  {
    name: 'application/x-font-pcf',
    extensions: ['pcf'],
  },
  {
    name: 'application/x-font-snf',
    extensions: ['snf'],
  },
  {
    name: 'application/x-font-type1',
    extensions: ['pfa', 'pfb', 'pfm', 'afm'],
  },
  {
    name: 'application/x-gtar',
    extensions: ['gtar'],
  },
  {
    name: 'application/x-iso9660-image',
    extensions: ['iso'],
  },
  {
    name: 'application/x-ms-wmd',
    extensions: ['wmd'],
  },
  {
    name: 'application/x-msaccess',
    extensions: ['mdb'],
  },
  {
    name: 'application/x-mspublisher',
    extensions: ['pub'],
  },
  {
    name: 'application/x-mswrite',
    extensions: ['wri'],
  },
  {
    name: 'application/x-tar',
    extensions: ['tar'],
  },
  {
    name: 'application/x-tex',
    extensions: ['tex'],
  },
  {
    name: 'application/x-tex-tfm',
    extensions: ['tfm'],
  },
  {
    name: 'application/x-texinfo',
    extensions: ['texinfo', 'texi'],
  },
  {
    name: 'application/zip',
    extensions: ['zip'],
  },
  {
    name: 'audio/adpcm',
    extensions: ['adp'],
  },
  {
    name: 'audio/basic',
    extensions: ['au', 'snd'],
  },
  {
    name: 'audio/midi',
    extensions: ['mid', 'midi', 'kar', 'rmi'],
  },
  {
    name: 'audio/mp4',
    extensions: ['m4a', 'mp4a'],
  },
  {
    name: 'audio/mpeg',
    extensions: ['mpga', 'mp2', 'mp2a', 'mp3', 'm2a', 'm3a'],
  },
  {
    name: 'audio/ogg',
    extensions: ['oga', 'ogg', 'spx'],
  },
  { name: 'audio/s3m', extensions: ['s3m'] },
  { name: 'audio/silk', extensions: ['sil'] },
  {
    name: 'audio/vnd.rip',
    extensions: ['rip'],
  },
  {
    name: 'audio/webm',
    extensions: ['weba'],
  },
  {
    name: 'audio/x-aac',
    extensions: ['aac'],
  },
  {
    name: 'audio/x-aiff',
    extensions: ['aif', 'aiff', 'aifc'],
  },
  {
    name: 'audio/x-caf',
    extensions: ['caf'],
  },
  {
    name: 'audio/x-flac',
    extensions: ['flac'],
  },
  {
    name: 'audio/x-matroska',
    extensions: ['mka'],
  },
  {
    name: 'audio/x-mpegurl',
    extensions: ['m3u'],
  },
  {
    name: 'audio/x-ms-wax',
    extensions: ['wax'],
  },
  {
    name: 'audio/x-ms-wma',
    extensions: ['wma'],
  },
  {
    name: 'audio/x-pn-realaudio',
    extensions: ['ram', 'ra'],
  },
  {
    name: 'audio/x-wav',
    extensions: ['wav'],
  },
  { name: 'audio/xm', extensions: ['xm'] },
  { name: 'font/otf', extensions: ['otf'] },
  { name: 'font/ttf', extensions: ['ttf'] },
  { name: 'font/woff', extensions: ['woff'] },
  {
    name: 'font/woff2',
    extensions: ['woff2'],
  },
  { name: 'image/bmp', extensions: ['bmp'] },
  { name: 'image/cgm', extensions: ['cgm'] },
  { name: 'image/g3fax', extensions: ['g3'] },
  { name: 'image/gif', extensions: ['gif'] },
  { name: 'image/ief', extensions: ['ief'] },
  {
    name: 'image/jpeg',
    extensions: ['jpeg', 'jpg', 'jpe'],
  },
  { name: 'image/ktx', extensions: ['ktx'] },
  { name: 'image/png', extensions: ['png'] },
  { name: 'image/sgi', extensions: ['sgi'] },
  {
    name: 'image/svg+xml',
    extensions: ['svg', 'svgz'],
  },
  {
    name: 'image/tiff',
    extensions: ['tiff', 'tif'],
  },
  {
    name: 'image/vnd.adobe.photoshop',
    extensions: ['psd'],
  },
  {
    name: 'image/vnd.dwg',
    extensions: ['dwg'],
  },
  {
    name: 'image/vnd.dxf',
    extensions: ['dxf'],
  },
  {
    name: 'image/x-3ds',
    extensions: ['3ds'],
  },
  {
    name: 'image/x-cmu-raster',
    extensions: ['ras'],
  },
  {
    name: 'image/x-cmx',
    extensions: ['cmx'],
  },
  {
    name: 'image/x-freehand',
    extensions: ['fh', 'fhc', 'fh4', 'fh5', 'fh7'],
  },
  {
    name: 'image/x-icon',
    extensions: ['ico'],
  },
  {
    name: 'image/x-mrsid-image',
    extensions: ['sid'],
  },
  {
    name: 'image/x-pcx',
    extensions: ['pcx'],
  },
  {
    name: 'image/x-pict',
    extensions: ['pic', 'pct'],
  },
  {
    name: 'image/x-portable-anymap',
    extensions: ['pnm'],
  },
  {
    name: 'image/x-portable-bitmap',
    extensions: ['pbm'],
  },
  {
    name: 'image/x-portable-graymap',
    extensions: ['pgm'],
  },
  {
    name: 'image/x-portable-pixmap',
    extensions: ['ppm'],
  },
  {
    name: 'image/x-rgb',
    extensions: ['rgb'],
  },
  {
    name: 'image/x-tga',
    extensions: ['tga'],
  },
  {
    name: 'image/x-xbitmap',
    extensions: ['xbm'],
  },
  {
    name: 'image/x-xpixmap',
    extensions: ['xpm'],
  },
  {
    name: 'image/x-xwindowdump',
    extensions: ['xwd'],
  },
  {
    name: 'text/calendar',
    extensions: ['ics', 'ifb'],
  },
  { name: 'text/css', extensions: ['css'] },
  { name: 'text/csv', extensions: ['csv'] },
  {
    name: 'text/html',
    extensions: ['html', 'htm'],
  },
  {
    name: 'text/plain',
    extensions: ['txt', 'text', 'conf', 'def', 'list', 'log', 'in'],
  },
  {
    name: 'text/richtext',
    extensions: ['rtx'],
  },
  {
    name: 'text/sgml',
    extensions: ['sgml', 'sgm'],
  },
  {
    name: 'text/tab-separated-values',
    extensions: ['tsv'],
  },
  { name: 'video/3gpp', extensions: ['3gp'] },
  {
    name: 'video/3gpp2',
    extensions: ['3g2'],
  },
  {
    name: 'video/h261',
    extensions: ['h261'],
  },
  {
    name: 'video/h263',
    extensions: ['h263'],
  },
  {
    name: 'video/h264',
    extensions: ['h264'],
  },
  {
    name: 'video/jpeg',
    extensions: ['jpgv'],
  },
  {
    name: 'video/jpm',
    extensions: ['jpm', 'jpgm'],
  },
  {
    name: 'video/mj2',
    extensions: ['mj2', 'mjp2'],
  },
  {
    name: 'video/mp4',
    extensions: ['mp4', 'mp4v', 'mpg4'],
  },
  {
    name: 'video/mpeg',
    extensions: ['mpeg', 'mpg', 'mpe', 'm1v', 'm2v'],
  },
  { name: 'video/ogg', extensions: ['ogv'] },
  {
    name: 'video/quicktime',
    extensions: ['qt', 'mov'],
  },
  {
    name: 'video/vnd.mpegurl',
    extensions: ['mxu', 'm4u'],
  },
  {
    name: 'video/vnd.vivo',
    extensions: ['viv'],
  },
  {
    name: 'video/webm',
    extensions: ['webm'],
  },
  {
    name: 'video/x-f4v',
    extensions: ['f4v'],
  },
  {
    name: 'video/x-fli',
    extensions: ['fli'],
  },
  {
    name: 'video/x-flv',
    extensions: ['flv'],
  },
  {
    name: 'video/x-m4v',
    extensions: ['m4v'],
  },
  {
    name: 'video/x-matroska',
    extensions: ['mkv', 'mk3d', 'mks'],
  },
  {
    name: 'video/x-mng',
    extensions: ['mng'],
  },
  {
    name: 'video/x-ms-asf',
    extensions: ['asf', 'asx'],
  },
  {
    name: 'video/x-ms-vob',
    extensions: ['vob'],
  },
  {
    name: 'video/x-ms-wm',
    extensions: ['wm'],
  },
  {
    name: 'video/x-ms-wmv',
    extensions: ['wmv'],
  },
  {
    name: 'video/x-ms-wmx',
    extensions: ['wmx'],
  },
  {
    name: 'video/x-ms-wvx',
    extensions: ['wvx'],
  },
  {
    name: 'video/x-msvideo',
    extensions: ['avi'],
  },
  {
    name: 'video/x-sgi-movie',
    extensions: ['movie'],
  },
  {
    name: 'video/x-smv',
    extensions: ['smv'],
  },
];
