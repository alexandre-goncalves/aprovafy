module.exports = async function(app, req, res, next) {
  if (req.path.endsWith("/login")) {
    next();
  } else {
    let header = req.header("Authorization");
    if (!header) {
      res.status(401);
      res.send({ ok: false });
    } else {
      const user = await app.models.User.findOne({ token: header });
      if (!user) {
        res.status(401);
        res.send({ ok: false });
      } else {
        next();
      }
    }
  }
};
