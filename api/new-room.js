module.exports = (req, res) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const segment = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const roomId = `${segment(3)}-${segment(4)}-${segment(3)}`;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ roomId });
};
