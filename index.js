const express = require("express");
const jsforce = require("jsforce");
const axios = require("axios");
const moment = require("moment");
const puppeteer = require("puppeteer");
require("dotenv").config();
//https://elements.heroku.com/buildpacks/jontewks/puppeteer-heroku-buildpack
//heroku builds:cache:purge -a <appname>
const HTMLToPDF = require("convert-html-to-pdf").default;

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/:version/:cat/:type/:so_id", async (req, res) => {
  var request = req.params;
  if (
    request.version &&
    request.cat &&
    request.type &&
    request.so_id &&
    request.so_id.length !== 18
  ) {
    res.send("Enter Valid URL");
    return;
  }

  //try {
  var token = await axios.post(
    request.version == "v1" ? process.env.SF_LOGIN_PRO : process.env.SF_LOGIN
  );

  var conn = new jsforce.Connection({
    instanceUrl:
      request.version == "v1"
        ? process.env.SF_BASEURL_PRO
        : process.env.SF_BASEURL,
    accessToken: token.data.access_token,
  });
  if (request.type == "invoice") {
    var SoData = await conn.query(
      `select Id, Name, OrderApi__Overall_Total__c, CurrencyIsoCode, OrderApi__Date__c, OrderApi__Paid_Date__c, OrderApi__Billing_City__c, OrderApi__Billing_Contact__c, OrderApi__Billing_Country__c, OrderApi__Billing_Postal_Code__c, OrderApi__Billing_State__c, OrderApi__Billing_Street__c, OrderApi__Contact__r.FON_Contact_Ref__c from OrderApi__Sales_Order__c where Id = '${request.so_id}'`,
      function (err, result) {
        if (err) {
          res.send({ err1: err });
          return;
        }
        return result.records;
      }
    );
    var SoLineData = await conn.query(
      `select Id, OrderApi__Sale_Price__c, OrderApi__Sales_Order__c, OrderApi__Item__r.FON_Journal_Item__c, OrderApi__Item_Name__c, OrderApi__Subscription_Plan__r.Name, OrderApi__Quantity__c, OrderApi__Subscription_Start_Date__c, OrderApi__End_Date__c, OrderApi__Subtotal__c, CurrencyIsoCode from OrderApi__Sales_Order_Line__c  where OrderApi__Sales_Order__c = '${request.so_id}'`,
      function (err, result) {
        if (err) {
          res.send({ err2: err });
          return;
        }
        return result.records;
      }
    );
  } else if (request.type == "reciept") {
    var SoData = await conn.query(
      `select Id, Name, OrderApi__Total__c, OrderApi__Payment_Type__c, OrderApi__Applied_Amount__c, CurrencyIsoCode, OrderApi__Date__c,  OrderApi__Billing_City__c, OrderApi__Billing_Contact__c, OrderApi__Billing_Country__c, OrderApi__Billing_Postal_Code__c, OrderApi__Billing_State__c, OrderApi__Billing_Street__c, OrderApi__Contact__r.FON_Contact_Ref__c from OrderApi__Receipt__c where Id = '${request.so_id}'`,
      function (err, result) {
        if (err) {
          res.send({ err1: err });
          return;
        }
        return result.records;
      }
    );
    var SoLineData = await conn.query(
      `select Id, OrderApi__Sale_Price__c, OrderApi__Sales_Order__c, OrderApi__Item__r.FON_Journal_Item__c, OrderApi__Item_Name__c, OrderApi__Subscription_Plan__r.Name, OrderApi__Quantity__c,   OrderApi__Subtotal__c, CurrencyIsoCode from OrderApi__Receipt_Line__c  where OrderApi__Receipt__c = '${request.so_id}'`,
      function (err, result) {
        if (err) {
          res.send({ err2: err });
          return;
        }
        return result.records;
      }
    );
  }

  if (SoLineData.length > 0) {
    var SOLineTxt = await processInvLine(SoLineData);
  } else {
    var SOLineTxt = [];
  }

  var CurDate = new Date();

  if (SoData.length > 0) {
    var result = await new Promise(async (resolve, reject) => {
      try {
        const html = `<!DOCTYPE html>
                <html lang="en">
                
                <head>
                    <meta charset="UTF-8">
                    <meta http-equiv="X-UA-Compatible" content="IE=edge">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>IWA Document</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet"
                        integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
                    <style>
                        
                        p {
                            font-size: 10px;
                        }
                
                        .fs-6 {
                            font-size: 12px !important;
                        }
                
                        .fs-5 {
                            font-size: 14px !important;
                        }
                
                        .fs-4 {
                            font-size: 22px !important;
                        }
                
                        .c_blue {
                            color: #00aeef
                        }
                
                        thead {
                            background: #00aeef;
                            color: #fff;
                        }
                        .payment-method {
                            background: #00aeef !important;
                            color: #000000;
                        }
                
                        .footer-box {
                            padding: 15px;
                            border: 1px solid #000;
                        }
      
                        table.table-bordered{
                          border:1px solid #000;
                          margin-top:20px;
                        }
                        table.table-bordered > thead > tr > th{
                            border:1px solid #000;
                        }
                        table.table-bordered > tbody > tr > td{
                            border:1px solid #000;
                        }
                
                        .border-top-hidden {
                            border-top: hidden;
                        }
                        tr.spacer {
                          height: 10em;
                        }
                        .border-bottom-dark{
                          border-bottom: 1px solid #000
                        }
                    </style>
                </head>
                
                <body class="mx-5">
                    <header>
                        <div class="container-fluid mt-5 pb-3">
                            <div class="row">
                                <div class="col-8">
                                    <img width='130px' class=""
                                        src="https://strapiimagetwo.s3.eu-west-2.amazonaws.com/IWA_Invoice_Logo_832f20cfd2.png">
                                </div>
                                <div class="col-4">
                                    <p class="my-0">International Water Association</p>
                                    <p class="mb-2">Unit 104-105, Export Building<br />
                                        1 Clove Crescent<br />
                                        London E14 2BA, UK</p>
                                    <p class="my-0">Tel: +44 (0)208 054 8215</p>
                                    <p class="my-0">Fax: +44 (0)207 654 5555</p>
                                </div>
                            </div>
                        </div>
                        <br/>
                        <div class="container-fluid mt-1">
                            <div class="row">
                                <div class="col-8">
                                    <p id="cut_name" class="fs-6 my-0">${
                                      SoData[0]?.OrderApi__Billing_Contact__c
                                    }</p>
                                    <p id="cut_add_street" class="fs-6 my-0">${
                                      SoData[0]?.OrderApi__Billing_Street__c
                                    }</p>
                                    <p id="cut_add_city" class="fs-6 my-0">${
                                      SoData[0]?.OrderApi__Billing_City__c
                                    }</p>
                                    <p id="cut_add_state" class="fs-6 my-0">${
                                      SoData[0]?.OrderApi__Billing_State__c
                                    }</p>
                                    <p id="cut_add_pc" class="fs-6 my-0">${
                                      SoData[0]
                                        ?.OrderApi__Billing_Postal_Code__c
                                    }</p>
                                    <p id="cut_add_country" class="fs-6 my-0">${
                                      SoData[0]?.OrderApi__Billing_Country__c
                                    }</p>
                                </div>
                                <div class="col-4">
                                    <h3 class="mb-2 fs-4 text-center w-100 c_blue"><b>${
                                      request.type == "invoice"
                                        ? "INVOICE"
                                        : "RECEIPT"
                                    }</b></h3>
                                    <table class="fs-5 w-100">
                                        <tr>
                                            <td><span class="c_blue">${
                                              request.type == "invoice"
                                                ? "Invoice"
                                                : "Receipt"
                                            } No:</span> </td>
                                            <td><span>${
                                              SoData[0]?.Name
                                            } </span></td>
                                        </tr>
                                        <tr>
                                            <td><span class="c_blue">${
                                              request.type == "invoice"
                                                ? "Invoice"
                                                : "Receipt"
                                            } Date:</span></td>
                                            <td><span>${moment(
                                              SoData[0]?.OrderApi__Date__c
                                            ).format("DD-MMM-YYYY")}</span></td>
                                        </tr>
                                        <tr>
                                            <td><span class="c_blue">Membership ID:</span></td>
                                            <td><span>${
                                              SoData[0].OrderApi__Contact__r
                                                ?.FON_Contact_Ref__c
                                            }</span></td>
                                        </tr>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="container-fluid mt-2">
                            <div class="row">
                                <div class="col-12">
                                    <table class="fs-5 w-100 table table-bordered">
                                        <thead>
                                            <tr>
                                                <th class="text-center" width="50px">Quantity</th>
                                                <th>Description</th>
                                                <th class="text-center" width="100px">Unit Price</th>
                                                <th class="text-center" width="80px">Price</th>
                                            </tr>
                                            <thead>
                                            <tbody>
                                                ${SOLineTxt}
                                                <tr class="spacer border-top-hidden">
                                                    <td></td>
                                                    <td></td>
                                                    <td></td>
                                                    <td></td>
                                                </tr>
                                            </tbody>
                                        <tfoot>
                                            <tr >
                                                <td rowspan="3" colspan="2">
                                                    <p class="my-0"><b>VAT Reg. No:</b> GB 740 4457 45</p>
                                                    <p class="my-0"><b>Terms:</b> Payment due on receipt of invoice, please quote invoice number with payment for easy reference .</p>
                                                </td>
                                                <td><p class="my-0">NET</p></td>
                                                <td class="text-end"><p class="my-0">${await convertCurrency(
                                                  request.type == "invoice"
                                                    ? SoData[0]
                                                        .OrderApi__Overall_Total__c
                                                    : SoData[0]
                                                        .OrderApi__Total__c,
                                                  SoData[0].CurrencyIsoCode
                                                )}</p></td>
                                            </tr>
                                            <tr>
                                                <td><p class="my-0">VAT</p></td>
                                                <td class="text-end"><p class="my-0">${await convertCurrency(
                                                  0,
                                                  SoData[0].CurrencyIsoCode
                                                )}</p></td>
                                            </tr>
                                            <tr>
                                                <td><p class="my-0">TOTAL</p></td>
                                                <td class="text-end"><p class="my-0">${await convertCurrency(
                                                  request.type == "invoice"
                                                    ? SoData[0]
                                                        .OrderApi__Overall_Total__c
                                                    : SoData[0]
                                                        .OrderApi__Total__c,
                                                  SoData[0].CurrencyIsoCode
                                                )}</p></td>
                                            </tr>
                                            ${
                                                request.type == "invoice"
                                                  ? ""
                                                  : `
                                                  <tr class="">
                                                    <td class="payment-method"></td>
                                                    <td class="payment-method"><p class="mb-1"><b>Payment Method:</b> ${SoData[0].OrderApi__Payment_Type__c}</p></td>
                                                    <td class="payment-method"><p class="my-0">PAID</p></td>
                                                    <td class="payment-method class="text-end""><p class="my-0">${await convertCurrency(
                                                        SoData[0]
                                                          .OrderApi__Applied_Amount__c,
                                                        SoData[0].CurrencyIsoCode
                                                      )}</p></td>
                                                </tr>
                                                  `
                                              }
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                        
                        <div class="container-fluid mt-2">
                            <div class="row">
                                <div class="col-12">
                                    <div class="footer-box">
                                    ${
                                      request.type == "invoice"
                                        ? `
                                        <p class="fs-5 mb-2"><b>Payment via bank transfer:</b></p>
                                        <table class="fs-6 w-100">
                                            <tr>
                                                <td><span class="fw-bold">Account:</span></td>
                                                <td><span>International Water Association</span></td>
                                            </tr>
                                            <tr>
                                                <td><span class="fw-bold">Sort Code:</span></td>
                                                <td><span>40-07-13</span></td>
                                            </tr>
                                            <tr>
                                                <td><span class="fw-bold">Account no:</span></td>
                                                <td><span>41 46 38 29</span></td>
                                            </tr>
                                            <tr>
                                                <td><span class="fw-bold">Swift Code:</span></td>
                                                <td><span>HBUKGB4B</span></td>
                                            </tr>
                                            <tr>
                                                <td><span class="fw-bold">IBAN:</span></td>
                                                <td><span>GB98 HBUK 4007 1341 4638 29</span></td>
                                            </tr>
                                            <tr>
                                                <td><span class="fw-bold">Bank:</span></td>
                                                <td><span>HSBC Plc, Victoria Street, London SW1H 0NJ, UK</span></td>
                                            </tr>
                                        </table>
                                        `
                                        : `
                                        <div class="d-flex justify-content-evenly">
                                            <p class="fs-5 text-center mb-0"><b>Payment received in full on:</b> &nbsp;${moment(
                                              SoData[0]?.OrderApi__Date__c
                                            ).format("DD-MMM-YYYY")}</p>
                                            <p class="fs-5 text-center mb-0">Thank You!</p>
                                        </div>
                                        `
                                    }
                                        
                                    </div>
                                    <div class="my-3">
                                        <p class="text-center">For any questions regarding this invoice please contact:
                                            members@iwahq.org </p>
                                        <p class="text-center"><i>COMPANY LIMITED BY GUARANTEE. REGISTERED IN ENGLAND NO. 3597005.
                                                REGISTERED OFFICE AS ABOVE. REGISTERED CHARITY (ENGLAND) NO. 1076690</i></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>
                </body>
                
                </html>
                `;

        var option = {
          browserOptions: {
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
          },
        };
        const htmlToPDF = new HTMLToPDF(html, option);

        const pdf = await htmlToPDF.convert({
          waitForNetworkIdle: true,
          browserOptions: { defaultViewport: { width: 1920, height: 1080 } },
          pdfOptions: { height: 1200, width: 900, timeout: 0 },
        });
        resolve(pdf);
      } catch (err) {
        reject(err);
      }
    });

    res.set("Content-Type", "application/pdf");
    res.set(
      "Content-disposition",
      `attachment;filename=${SoData[0].Name}-${moment(CurDate).format(
        "DD-MM-YYYY"
      )}.pdf`
    );
    res.send(result);
  } else {
    res.send("No Data");
  }
  //} catch (error) {
  // res.send({ err2: error });
  //return;
  //}

  return;
});

const processInvLine = async (value) => {
  var text = "";
  for (const item of value) {
    text += ` <tr class="border-top-hidden">
            <td class="text-center"><p class="mb-1">${item.OrderApi__Quantity__c}</p></td>
            <td>
              <p class="mb-1"><b>${item.OrderApi__Item_Name__c}&nbsp;${
      item.OrderApi__Item__r.FON_Journal_Item__c == false
        ? "Membership Subscription"
        : ""
    }</b></p>
              <p class="mb-1">${
                item.OrderApi__Subscription_Plan__r?.Name
                  ? item.OrderApi__Subscription_Plan__r?.Name
                  : ""
              }</p>
            </td>
            <td class="text-end"><p class="mb-1">${await convertCurrency(
              item.OrderApi__Sale_Price__c,
              item.CurrencyIsoCode
            )}</p></td>
            <td class="text-end"><p class="mb-1">${await convertCurrency(
              item.OrderApi__Subtotal__c,
              item.CurrencyIsoCode
            )}</p></td>
        </tr> `;
  }
  return text;
};

const convertCurrency = async (value, code) => {
  var amt = value.toLocaleString("en-UK", {
    style: "currency",
    currency: code,
  });
  return amt;
};

app.listen(PORT, (error) => {
  if (!error)
    console.log(
      "Server is Successfully Running, and App is listening on port " + PORT
    );
  else console.log("Error occurred, server can't start", error);
});
