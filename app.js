require("dotenv").config();
const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const app = express();
const ejs = require("ejs");
//Using the required tools
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(session({
  secret: "process.env.SESSIONS_SECRET",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
//--------------------------------------------------------------
//--------------------------------------------------------------

//Mongodb Start and setting Schema's
mongoose.connect(process.env.MONGO_URI, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false
});
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String,
  secret: String
});

const eventSchema = new mongoose.Schema ({
  name: String,
  location: String,
  description: String,
  totalAvailebleTickets: Number,
  agelimit: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const Event = mongoose.model("Event", eventSchema);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done){
  done(null, user.id);
});

passport.deserializeUser(function(id, done){
  User.findById(id, function(err, user){
      done(err, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "https://safe-eyrie-40007.herokuapp.com/auth/google/eventadd",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
function(accessToken, refreshToken, profile, cb){
  const username = profile.displayName + profile.id;
  User.findOrCreate({googleId: profile.id, username:username}, function(err, user){
    return cb(err, user);
  });
}
));
//--------------------------------------------------------------
//--------------------------------------------------------------

//GET routes
app.get("/", function(req, res) {

  Event.find({}, function(err, foundEvents) {
    if (err) {
      console.log(err)
    } else {
    
    }
    res.render("frontpage", {
      eventTitleEjs: foundEvents
    });
  });
});
//--------------------------------------------------------------
//--------------------------------------------------------------
//POST routes
app.post('/event', function(req, res) {
  const eventTicketName = req.body.eventName;
  const queryEvent = Event.findOne({
    name: eventTicketName
  }, function(err, docs) {
    if (!err) {
      const availebleTickets = docs.totalAvailebleTickets;
      const eventName = docs.name;
      const eventLocation = docs.location;
     
      res.render("buytickets", {
        eventTicketsEjs: eventName,
        availebleTicketsEjs: availebleTickets,
        eventLocationEjs: eventLocation
      });
    } else {
      console.log(err);
    }
  });
});
//--------------------------------------------------------------

app.post("/addevent", function(req, res) {
  const eventname = req.body.eventname;
  const eventlocation = req.body.eventlocation;
  const eventdescription = req.body.description;
  const totalAvailebleTickets = req.body.totalavailebletickets;
  const agelimit = req.body.agelist;
  const event = new Event({
    name: eventname,
    location: eventlocation,
    description: eventdescription,
    totalAvailebleTickets: totalAvailebleTickets,
    agelimit: agelimit
  });
  event.save();
  res.redirect("/");
});

//--------------------------------------------------------------
app.post("/buytickets", function(req, res) {

  const boughtTickets = req.body.ticketAmount;
  const eventName = req.body.eventName;
  const eventLocation = req.body.eventLocation;
  
  const eventDb = Event.findOne({
    name: eventName
  }, function(err, docs) {
    if (!err) {
      const totalAvailebleTickets = docs.totalAvailebleTickets;
      const ticketsLeft = totalAvailebleTickets - boughtTickets;

      Event.findOneAndUpdate({
        name: eventName
      }, {
        $set: {
          totalAvailebleTickets: ticketsLeft
        }
      }, {
        new: true
      }, (err, doc) => {

        if (err) {
          console.log("Something wrong when updating data!");
        }
        
      
      });
    } else {
      console.log(err);
    }
  });
  res.render("ticketsbought", {
    eventNameEjs: eventName,
    eventLocationEjs: eventLocation
  });

});
//--------------------------------------------------------------
app.post("/deleteEvent", function(res,req){
  const eventName = res.body.eventName;
  Event.findOneAndDelete({name: eventName}, function(err,doc){
    if(!err){
    const deletedEvent = doc;
    console.log("Succesfully deleted " + doc.name + " from the database.");
    }else{
    console.log(err);
    }
  });

  req.redirect("/eventadd");
});
//--------------------------------------------------------------
//--------------------------------------------------------------

//Makes the button on the homepage go to the addevent page
app.get("/login", function(req, res){
  res.render("login");
});
app.get("/auth/google",
    passport.authenticate('google', { scope: ["profile"] })
  );

 app.get("/auth/google/eventadd",
    passport.authenticate('google', { failureRedirect: "/login" }),
    function(req, res) {
      // Successful authentication, redirect to secrets.
      res.redirect("/eventadd");
    });
    app.post("/login", function(req, res){

      const user = new User({
        username: req.body.username,
        password: req.body.password
      });
    
      req.login(user, function(){
       
          passport.authenticate("local")(req, res, function(){
            res.redirect("/eventadd");
          });
        
      });
    
    });
  

app.post("/register", function(req, res){

  User.register({username: req.body.username}, req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local", {scope: "email"})(req, res, function(){
        res.redirect("/eventadd");
      });
    }
  });

});

app.get('/eventadd',function(req, res) {
  if(req.isAuthenticated()){
    Event.find({}, function(err, docs){
        const foundEvents = docs;
        res.render("eventadd", {eventListEjs: foundEvents});
     });
    }else{
      res.redirect("/login");
    }
  });

//Makes th button on the ticketsbought page redirect to the home route
app.route('/backToHome')
  .get(function(req, res) {
    res.redirect("/");
  });
//--------------------------------------------------------------
//--------------------------------------------------------------

//Start server

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
  console.log("Server started");
});
