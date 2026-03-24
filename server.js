const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = 3000;

const VALID_USERNAME = "VerySecureThankYou";
const VALID_PASSWORD = "ToldYouImSecure";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "replace-this-with-a-long-random-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true
    }
  })
);

app.use("/static", express.static(path.join(__dirname, "public")));

function requireLogin(req, res, next) {
  if (!req.session.loggedIn) {
    return res.redirect("/");
  }
  next();
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === VALID_USERNAME && password === VALID_PASSWORD) {
    req.session.loggedIn = true;
    return res.redirect("/nextpage");
  }

  return res.status(401).send(`
    <h1>Login failed</h1>
    <p>Invalid credentials.</p>
    <a href="/">Try again</a>
  `);
});

app.get("/nextpage", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "nextpage.html"));
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});