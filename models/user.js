module.exports = function(app) {
  const User = app.db.model("User", {
    email: String,
    password: String,
    createdAt: Date,
    updatedAt: Date,
    token: String,
    spotifyToken: String,
    refreshToken: String
  });

  return User;
};
