// Next.js turns an image import into a { src, height, width } object. Jest cannot parse the
// binary, so every image import resolves to this stand-in instead — see jest.config.js.
module.exports = { src: "", height: 1, width: 1 };
