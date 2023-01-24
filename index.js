const dotenv = require("dotenv");
const mysql = require("mysql2");
const express = require("express");
const cors = require("cors");

const app = express();
dotenv.config();

const port = 5000;
const DATABASE_URL =
  'mysql://ndaupe9jpnrsscnf5jpm:pscale_pw_bMhSroZ3PdrAEMhwCs6UZHSpekV7DT2O0UpUJMj8Jj3@eu-central.connect.psdb.cloud/task4?ssl={"rejectUnauthorized":true}';

app.use(express.json());
app.use(cors());

const db = mysql.createConnection(DATABASE_URL);

db.connect(function (err) {
  if (err) {
    return console.error("error: " + err.message);
  }
  console.log("Connected to the PlanetScale DB server.");
});

app.get("/users", (req, res) => {
  db.query("SELECT * FROM users", (error, result) => {
    if (error) {
      res.status(404).send({ message: error });
    } else {
      res.status(200).send(result);
    }
  });
});

app.post("/register", (req, res) => {
  const userName = req.body.name;
  const userEmail = req.body.email;
  const userPassword = req.body.password;
  const date = new Date();

  db.query(
    "INSERT INTO users (user_name, user_email, user_password, last_login_time, reg_time, user_status) VALUES (?,?,?,?,?,?)",
    [userName, userEmail, userPassword, date, date, "active"],
    (error, result) => {
      if (error?.code === "ER_DUP_ENTRY") {
        res
          .status(409)
          .send({ message: "User with this email already exists." });
      } else if (error) {
        res.status(400).send({ message: "Something went wrong." });
      } else {
        db.query(
          "SELECT * FROM users WHERE id = ?",
          [result.insertId],
          (error, result) => {
            res.status(201).send(result[0]);
          }
        );
      }
    }
  );
});

function updateLoginTime(id) {
  db.query(
    `UPDATE users
  SET last_login_time = ? WHERE id = ?`,
    [new Date(), id]
  );
}

app.post("/login", (req, res) => {
  const userName = req.body.name;
  const userEmail = req.body.email;
  const userPassword = req.body.password;

  db.query(
    "SELECT * FROM users WHERE user_name = ? AND user_email = ? AND user_password = ?",
    [userName, userEmail, userPassword],
    (error, result) => {
      if (error) {
        res.status(400).send({ message: error });
      } else {
        if (result.length > 0 && result[0].user_status === "active") {
          updateLoginTime(result[0].id);
          res.status(200).send(result[0]);
        } else if (result.length > 0 && result[0].user_status === "blocked") {
          res.status(401).send({ message: "This user is blocked!" });
        } else {
          res.status(401).send({ message: "Wrong credentials!" });
        }
      }
    }
  );
});

async function isDeletedOrBlocked(id) {
  let deletedOrBlockedUser;
  try {
    const [result, fields] = await db
      .promise()
      .query("SELECT * FROM users WHERE id = ?", [id]);
    if (result.length === 0 || result[0].user_status === "blocked") {
      deletedOrBlockedUser = true;
    } else {
      deletedOrBlockedUser = false;
    }
  } catch (err) {
    throw new Error(err);
  }
  return deletedOrBlockedUser;
}

app.post("/block", async (req, res) => {
  const userIds = req.body.checkedUsers;
  const activeUser = req.body.activeUser;
  if (await isDeletedOrBlocked(activeUser)) {
    res.status(403).send({ message: "Forbidden to block" });
  } else {
    let sql = `UPDATE users
    SET user_status = ?
    WHERE id in (?)`;
    db.query(sql, ["blocked", [...userIds]], (error, result) => {
      if (error) {
        res.status(400).send({ message: error });
      } else {
        res.status(200).send({ message: "Users blocked" });
      }
    });
  }
});

app.post("/unblock", async (req, res) => {
  const userIds = req.body.checkedUsers;
  const activeUser = req.body.activeUser;
  if (await isDeletedOrBlocked(activeUser)) {
    res.status(403).send({ message: "Forbidden to unblock" });
  } else {
    let sql = `UPDATE users
    SET user_status = ?
    WHERE id in (?)`;
    db.query(sql, ["active", [...userIds]], (error, result) => {
      if (error) {
        res.status(400).send({ message: error });
      } else {
        res.status(200).send({ message: "Users unblocked!" });
      }
    });
  }
});

app.post("/delete", async (req, res) => {
  const userIds = req.body.checkedUsers;
  const activeUser = req.body.activeUser;
  if (await isDeletedOrBlocked(activeUser)) {
    res.status(403).send({ message: "Forbidden to delete" });
  } else {
    let sql = `DELETE FROM users
           WHERE id in (?)`;
    db.query(sql, [[...userIds]], (error, result) => {
      if (error) {
        res.status(400).send({ message: error });
      } else {
        res.status(200).send({ message: `Users deleted!` });
      }
    });
  }
});

app.listen(port, () => {
  console.log(`Running on port ${port}`);
});
