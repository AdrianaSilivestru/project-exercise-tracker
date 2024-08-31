const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
require("dotenv").config();

app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

const uri = process.env.MONGO_URI;
mongoose.connect(uri);

//create schemas
let exerciseSessionSchema = new mongoose.Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: String,
});

let userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  log: [exerciseSessionSchema],
});

//create models
let Session = mongoose.model("Session", exerciseSessionSchema);
let User = mongoose.model("User", userSchema);

//posting user to mongodb
app.post(
  "/api/users",
  bodyParser.urlencoded({ extended: false }),
  async (req, res) => {
    try {
      let newUser = new User({ username: req.body.username });
      let savedUser = await newUser.save();

      let responseObj = {
        username: savedUser.username,
        _id: savedUser.id,
      };
      res.json(responseObj);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create user" });
    }
    console.log(req.body);
  }
);

app.get("/api/users", async (req, res) => {
  try {
    let arrOfUsers = await User.find({});
    res.json(arrOfUsers);
  } catch (err) {
    console.log(err);
  }
});

app.post(
  "/api/users/:_id/exercises",
  bodyParser.urlencoded({ extended: false }),
  async (req, res) => {
    console.log(req.body);
    try {
      let newSession = new Session({
        description: req.body.description,
        duration: req.body.duration,
        date: req.body.date || new Date().toISOString().substring(0, 10),
      });

      let updatedUser = await User.findByIdAndUpdate(
        req.params._id,
        { $push: { log: newSession } },
        { new: true }
      );
      res.json({
        _id: updatedUser.id,
        username: updatedUser.username,
        description: newSession.description,
        duration: newSession.duration,
        date: new Date(newSession.date).toDateString(),
      });
    } catch (err) {
      console.log(err);
    }
  }
);

app.get("/api/users/:_id/logs", async (req, res) => {
  try {
    let foundUser = await User.findById(req.params._id);
    if (!foundUser) {
      console.log(`User not found with ID: ${req.params._id}`);
      return res.status(404).json({ error: "User not found" });
    }
    let resObj = {
      _id: foundUser._id,
      username: foundUser.username,
      count: foundUser.log.length,
      log: foundUser.log.map((session) => ({
        description: session.description,
        duration: session.duration,
        date: new Date(session.date).toDateString(),
      })),
    };

    if (req.query.from || req.query.to) {
      //creating 2 date objects
      let fromDate = new Date(0);
      let toDate = new Date();
      //updating the date objects if they were passed in query
      if (req.query.from) {
        fromDate = new Date(req.query.from);
      }
      if (req.query.to) {
        toDate = new Date(req.query.to);
      }
      //making the objects in utc format
      fromDate = fromDate.getTime();
      toDate = toDate.getTime();

      //filtering the log array to contain only the session objects between spec dates
      resObj.log = resObj.log.filter((session) => {
        let sessionDate = new Date(session.date).getTime();
        return sessionDate >= fromDate && sessionDate <= toDate;
      });
    }

    if (req.query.limit) {
      resObj.log = resObj.log.slice(0, parseInt(req.query.limit));
    }

    res.json(resObj);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
