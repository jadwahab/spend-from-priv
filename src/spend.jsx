import React, { Component } from "react";
import {
  Button,
  Form,
  Grid,
  Header,
  Image,
  Divider,
  Input,
  Label,
  TextArea
} from "semantic-ui-react";
import bsv from "bsv";
import request from "request-promise-native";

async function getUtxosFromBitIndex(address) {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    uri: "https://api.bitindex.network/api/addrs/utxo",
    body: {
      addrs: address
    },
    json: true,
    timeout: 5000
  };

  try {
    let utxos = await request(options);

    // Sort these in descending order of confirmation (oldest first)...
    utxos.sort((a, b) => b.confirmations - a.confirmations);

    const spendableUtxos = [];

    for (let i = 0; i < utxos.length; i++) {
      let include = true;
      // if (utxos[i].confirmations < 100) {
      //   // Check if this is a coinbase
      //   const tx = await getRawTransaction('BSV', utxos[i].txid)
      //   if (tx.vin[utxos[i].vout].coinbase) {
      //     include = false
      //   }
      // }
      if (include) {
        spendableUtxos.push(
          new bsv.Transaction.UnspentOutput({
            address: utxos[i].address,
            script: bsv.Script(utxos[i].script),
            satoshis: utxos[i].satoshis,
            outputIndex: utxos[i].outputIndex,
            txid: utxos[i].txid
          })
        );
      }
    }

    return spendableUtxos;
  } catch (err) {
    throw err;
  }
}

async function broadcastTx(transactionHex) {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    uri: "https://api.whatsonchain.com/v1/bsv/main/tx/raw",
    body: {
      txhex: transactionHex
    },
    json: true,
    timeout: 5000
  };

  try {
    let response = await request(options);

    console.log("WOC response");
    console.log(response);

    return response;
  } catch (err) {
    throw err;
  }
}

// ------------------ COMPONENT ------------------
class Spend extends Component {
  constructor(props) {
    super(props);
    this.state = {
      privkey: "",
      pubkey: "",
      WOClink: "",
      value: "",
      properFormatPubKey: true,
      properFormatPrivKey: true,
      broadcastResponse: "",
      loading: false
    };
    this.handleChange = this.handleChange.bind(this);
  }

  // Show label invalid priv key
  displayFormatLabelPrivKey() {
    if (this.state.properFormatPrivKey) {
      return "";
    } else {
      return (
        <Label basic color="red" pointing="below">
          Please enter a valid private key
        </Label>
      );
    }
  }

  // Show label invalid public key
  displayFormatLabelPubKey() {
    if (this.state.properFormatPubKey) {
      return "";
    } else {
      return (
        <Label basic color="red" pointing="below">
          Please enter a valid public key in compressed form
        </Label>
      );
    }
  }

  displayWOCLink() {
    if (this.state.broadcastResponse === "") {
      return "";
    } else {
      return (
        <div>
          <Divider hidden />
          <a
            className="btn btn-primary"
            target="_blank"
            href={`https://www.whatsonchain.com/tx/${this.state.broadcastResponse}`}
          >
            What's on chain!
          </a>
        </div>
      );
    }
  }

  handleChange = e => {
    this.setState({
      [e.target.name]: e.target.value
    });
  };

  handleSubmit = async e => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ loading: true });

    var privKey, pubKeyFrom, pubKeyTo;

    try {
      privKey = new bsv.PrivateKey(this.state.privkey);
      pubKeyFrom = privKey.toPublicKey();
      this.setState({
        properFormatPrivKey: true
      });
    } catch (error) {
      this.setState({ properFormatPrivKey: false });
    }

    try {
      pubKeyTo = new bsv.Address.fromString(this.state.pubkey);
      this.setState({
        properFormatPubKey: true
      });
    } catch (error) {
      this.setState({ properFormatPubKey: false });
    }

    if (privKey && pubKeyTo) {
      let utxos = await getUtxosFromBitIndex(pubKeyFrom.toAddress().toString());
      console.log("UTXOS:");
      console.log(utxos);
      var transaction = new bsv.Transaction()
        .from(utxos) // Feed information about what unspent outputs one can use
        //   .addData("THRESHOLD SIGNATURE TRANSACTION 3") // Add OP_RETURN data
        .change(pubKeyTo)
        .sign(privKey);

      console.log("Tx:");
      console.log(transaction.toString());

      try {
        let broadcastResponse = await broadcastTx(transaction.toString());
        this.setState({ broadcastResponse });
      } catch (error) {
        console.log("WOC broadcast error");
      }
    }
    this.setState({ loading: false });
  };

  render() {
    return (
      <Grid
        textAlign="center"
        style={{ height: "50vh" }}
        verticalAlign="middle"
      >
        <Grid.Column style={{ maxWidth: 675 }}>
          {/* <Form onSubmit={this.handleSubmit}> */}
          <Form>
            {this.displayFormatLabelPrivKey()}
            <Input
              placeholder="Private Key"
              style={{ justifyContent: "center", width: "535px" }}
              onChange={this.handleChange}
              name="privkey"
            />
            <Divider></Divider>
            {this.displayFormatLabelPubKey()}
            <Input
              action={{
                content: "Create Tx",
                onClick: () => this.handleSubmit()
              }}
              placeholder="Send Bitcoin Address (P2PKH)"
              style={{ justifyContent: "center", width: "535px" }}
              onChange={this.handleChange}
              name="pubkey"
            />
          </Form>

          {this.state.loading ? "loading..." : ""}

          {this.displayWOCLink()}
        </Grid.Column>
      </Grid>
    );
  }
}

export default Spend;
