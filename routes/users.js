var express = require("express");
var router = express.Router();
var crypto = require("crypto");
var jwt = require("jsonwebtoken");

router.post("/logout", async function(req, res, next) {
  const app = global.app;

  const user = await app.models.User.findOne({
    token: req.header("Authorization")
  });

  if (user && user.token) {
    user.token = null;
    await user.save();
  }

  res.send({ ok: true });
});

router.post("/login", async function(req, res, next) {
  const app = global.app;

  let isValid = false;
  const user = await app.models.User.findOne({ email: req.body.email });

  if (user) {
    let hash = encrypt(req.body.password, user.createdAt);
    isValid = user.password === hash;
  }

  if (isValid && !user.token) {
    const token = jwt.sign(
      { date: new Date().getTime().toString() },
      app.secretKey
    );

    user.token = token;
    await user.save();
  }

  res.json({
    user: {
      email: user.email,
      token: user.token
    },
    ok: isValid
  });
});

/* GET users listing. */
router.get("/", async function(req, res, next) {
  const app = global.app;

  const list = await app.models.User.find({});

  res.json({
    list: list.map(l => {
      return {
        _id: l._id,
        email: l.email
      };
    }),
    ok: true
  });
});

router.post("/", async function(req, res, next) {
  const app = global.app;

  var now = new Date();
  const password = encrypt(req.body.password, now);
  console.log(app.models);

  const user = new app.models.User({
    email: req.body.email,
    createdAt: now,
    updatedAt: now,
    password: password
  });

  await user.save();

  res.json({ ok: true });
});

function encrypt(text, salt) {
  let hash = crypto.createHmac("sha512", salt.getTime().toString());
  hash.update(text);
  let value = hash.digest("hex");

  return value;
}

module.exports = router;
