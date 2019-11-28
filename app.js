let secretKey = "secret";

const userModel = require("./models/user");
let url =
  process.env.NODE_ENV || "dev"
    ? "mongodb://localhost:27017/aprovafy"
    : process.env.MONGODB_URI;

async function connect(app) {
  console.log("Environment " + process.env.NODE_ENV || "dev");
  console.log("Connecting to " + url);

  const mongoose = require("mongoose");
  const connection = await mongoose.connect(url, {
    useNewUrlParser: true
    // useUnifiedTopology: process.env.NODE_ENV || "dev" ? true : false
  });

  console.log("Connected");

  app.db = connection;
  app.models = {};

  app.models.User = userModel(app);
}

var express = require("express");
var path = require("path");
var favicon = require("serve-favicon");
var logger = require("morgan");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var cors = require("cors");

var routes = require("./routes/index");
var users = require("./routes/users");
var spotify = require("./routes/spotify");

var app = express();

var auth = require("./middlewares/auth");

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());

app.use("/", (req, res, next) => auth(app, req, res, next), routes);

app.use("/user", (req, res, next) => auth(app, req, res, next), users);

app.use("/spotify", (req, res, next) => auth(app, req, res, next), spotify);

app.use(
  "/spotify/auth/:code",
  (req, res, next) => auth(app, req, res, next),
  spotify
);

app.use(
  "/spotify/callback",
  (req, res, next) => auth(app, req, res, next),
  spotify
);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get("env") === "development") {
  app.use(function(err, req, res, next) {
    console.error(err);
    res.status(err.status || 500);
    res.json({
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: {}
  });
});

connect(app);

app.secretKey = secretKey;
global.app = app;

module.exports = app;
