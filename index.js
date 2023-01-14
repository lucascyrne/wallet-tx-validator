const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const fs = require("fs");

const app = express();

/* 
*  Fetch all unvalidated transactions.
?  @return [{ tx }] an array with N transaction objects (N >= 1).
*/
function getAllUnvalidatedTx(res) {
  fs.readFile("./tx_history.md", "utf8", (error, fileData) => {
    if (error) {
      console.error(error);
      res.status(500).send();
    }

    let txJson = JSON.parse(fileData);
    let txData = txJson.filter((tx) => {
      return tx.isValidated == "0";
    });
    res.status(200).send(txData);
  });
}

/* 
* Fetch all unvalidated transactions that fullfils specific parameters.
  @param {string} from - from which wallet the transaction is coming.
  @param {string} to - to which wallet the transaction is going.
  @param {string} value - the value of the transaction.
? @return [{ tx }] an array with N transactions objects (N >= 1).
*/
function getUnvalidatedTx(from, to, value, res) {
  const searchTxObject = {
    from: from,
    to: to,
    value: value,
    isValidated: "0",
  };

  fs.readFile("./tx_history.md", "utf8", (err, fileData) => {
    if (err) {
      console.error(err);
      response.isError = "0";
      response.message = err;
      response.data = null;
      res.status(500).send();
    }

    const txJson = JSON.parse(fileData);
    const foundTx = txJson.filter((item) => {
      return (
        item.from == searchTxObject.from &&
        item.to == searchTxObject.to &&
        item.value == searchTxObject.value &&
        item.isValidated == searchTxObject.isValidated
      );
    });

    res.status(200).send(foundTx);
  });
}

/* 
*  Validate or invalidate many transactions.
   @param {number} mode - changes between "validate" and "invalidate".
   @param {string} startBlock - from which block we will start "consume".
   @param {string} endBlock - to which block we will finish "consume".
?  @return updates N { tx } in transaction history (N >= 2).
*/
function consumeManyTx(mode, startBlock, endBlock, res) {
  fs.readFile("./tx_history.md", "utf8", (err, fileData) => {
    if (err) {
      console.error(err);
      res.status(500).send();
    }

    let txJson = JSON.parse(fileData);

    let updatedTxJson = txJson.map((tx) => {
      if (tx.blockNumber >= startBlock && tx.blockNumber <= endBlock) {
        if (mode === "0") {
          return { ...tx, isValidated: "0" };
        } else if (mode === "1") {
          return { ...tx, isValidated: "1" };
        } else {
          console.error("👷 Something went wrong. Consume mode not defined.");
          return tx;
        }
      }
      return tx;
    });

    fs.writeFile(
      "./tx_history.md",
      JSON.stringify(updatedTxJson, null, 2),
      "utf8",
      (err) => {
        if (err) {
          console.error(err);
          res.status(500).send();
        }
        res.status(200).send();
      }
    );

    streamTxs("0", res);
  });
}

/* 
*  Validate or invalidate a single transaction.
   @param {number} mode - changes between "validate" and "invalidate".
   @param {string} tx_hash - the transaction hash of the transaction to be "consumed".
?  @return updates a single { tx } in transaction history.
*/
function consumeTx(mode, tx_hash, res) {
  fs.readFile("./tx_history.md", "utf8", (err, fileData) => {
    if (err) {
      console.error(err);
      res.status(500).send();
    }

    let txJson = JSON.parse(fileData);

    let updatedTxJson = txJson.map((tx) => {
      if (tx.tx_hash == tx_hash) {
        if (mode === "0") {
          return { ...tx, isValidated: "0" };
        } else if (mode === "1") {
          return { ...tx, isValidated: "1" };
        } else {
          console.error("👷 Something went wrong. Consume mode not defined.");
          return tx;
        }
      }
      return tx;
    });

    fs.writeFile(
      "./tx_history.md",
      JSON.stringify(updatedTxJson, null, 2),
      "utf8",
      (err) => {
        if (err) {
          console.error(err);
          res.status(500).send();
        }
      }
    );

    streamTxs("0", res);
  });
}

/* 
* Mirror the original transaction file to the backup transaction file.
  @param {string} mode - change the file copy direction.
? @return update transaction backup file.
*/
const streamTxs = (mode, res) => {
  if (mode === "0") {
    fs.copyFile("./tx_history.md", "./tx_history_backup.md", (err) => {
      if (err) {
        console.error(err);
        res.status(500).send();
      }
      res.status(200).send();
    });
  } else if (mode === "1") {
    fs.copyFile("./tx_history_backup.md", "./tx_history.md", (err) => {
      if (err) {
        console.error(err);
        res.status(500).send();
      }
      res.status(200).send();
    });
  } else {
    console.error("👷 Error: Copy mode not specified.");
  }
};

/* 
* Fetch all transactions registered in Alfajores blockchain.
? @return updates transaction main & backup file with new data.
*/
const fetchTxs = async (res) => {
  // account 1: 0x8dB402e86Bc94bD1F15Ab00E7D89b94ADd493c64
  // account 2: 0xE7AE37EEe6b95852768dB502FB3BB160De1D952a

  if (!fs.existsSync("./tx_history.md")) {
    fs.writeFile("./tx_history.md", JSON.stringify([]), (err) => {
      if (err) {
        console.error(err);
        res.status(500).send();
      }
    });
  }

  if (!fs.existsSync("./tx_history_backup.md")) {
    fs.writeFile("./tx_history_backup.md", JSON.stringify([]), (err) => {
      if (err) {
        console.error(err);
        res.status(500).send();
      }
    });
  }

  const data = await fetch(
    "https://api-alfajores.celoscan.io/api?module=account&action=txlist&address=0xE7AE37EEe6b95852768dB502FB3BB160De1D952a&sort=asc&apikey=YourApiKeyToken"
  )
    .then((res) => res.json())
    .then((json) => {
      const data = [];

      for (var i = 0; i < json.result.length; i++) {
        const tx = {
          blockNumber: "",
          tx_hash: "",
          from: "",
          to: "",
          isValidated: "0",
          isError: "",
          value: "0",
        };

        tx.blockNumber = json.result[i].blockNumber;
        tx.tx_hash = json.result[i].hash;
        tx.from = json.result[i].from;
        tx.to = json.result[i].to;
        tx.isError = json.result[i].isError;
        tx.value = (json.result[i].value / 1000000000000000000).toString();

        data.push(tx);
      }

      return data;
    });

  fs.readFile("./tx_history.md", "utf8", (err, fileData) => {
    if (err) {
      console.error(err);
      res.status(500).send();
    }

    if (fileData == "[]" || fileData == "") {
      fs.writeFile(
        "./tx_history.md",
        JSON.stringify(data, null, 2),
        "utf8",
        (err) => {
          if (err) {
            console.error(err);
            res.status(500).send();
          }
        }
      );
    } else {
      let txJson = JSON.parse(fileData);

      let updatedTxJson = txJson.map((tx) => {
        if (tx.isValidated == "1") {
          return tx;
        }
        return tx;
      });

      fs.writeFile(
        "./tx_history.md",
        JSON.stringify(updatedTxJson, null, 2),
        "utf8",
        (err) => {
          if (err) {
            console.error(err);
            res.status(500).send();
          }
          res.status(200).send();
        }
      );
    }
  });

  streamTxs("0", res);
};

let intervalId;
app.get("/start", (req, res) => {
  const interval = req.params.mode;
  intervalId = setInterval(() => {
    fetchTxs(res);
  }, 5000);
  res.status(200).send(`Interval set with id: ${intervalId}`);
});

app.get("/stop/:intervalId", (req, res) => {
  const id = req.params.intervalId;
  clearInterval(id);
  res.status(200).send(`Interval with id ${id} stopped`);
});

app.get("/recover/:mode", (req, res) => {
  const mode = req.params.mode;
  streamTxs(mode, res);
});

app.post("/transactions/:mode/:tx_hash", (req, res) => {
  const mode = req.params.mode;
  const tx_hash = req.params.tx_hash;
  consumeTx(mode, tx_hash, res);
});

app.post("/transactions/n/:mode/:startBlock/:endBlock", (req, res) => {
  const mode = req.params.mode;
  const startBlock = req.params.startBlock;
  const endBlock = req.params.endBlock;
  consumeManyTx(mode, startBlock, endBlock, res);
});

app.get("/transactions/:from/:to/:value", (req, res) => {
  const from = req.params.from;
  const to = req.params.to;
  const value = req.params.value;
  getUnvalidatedTx(from, to, value, res);
});

app.get("/transactions/n", (req, res) => {
  getAllUnvalidatedTx(res);
});

app.use(cors());
app.listen(3000, () => {
  console.log("Server listening on port 3000");
});
