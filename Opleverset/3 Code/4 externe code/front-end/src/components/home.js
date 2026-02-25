var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import date from 'date-and-time';
function Home() {
    const [deelnemers, setDeelnemers] = useState([]);
    const [deelnemernaamInput, setDeelnemernaamInput] = useState("");
    const [deelnemernieuwenaamInput, setdeelnemernieuwenaamInput] = useState([]);
    const [deelnemerpunteninput, setdeelnemerpunteninput] = useState([]);
    const [showPopup, setShowpopup] = useState(false);
    const [selectedDeelnemer, setSelectedDeelnemer] = useState(0);
    const [history, setHistory] = useState([]);
    const [adminPass, setAdminPass] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [intervalCount, setIntervalCount] = useState(0);
    function GetAllDeenemers() {
        try {
            fetch("/api/allDeelnemers", {
                method: "GET"
            }).then((res) => {
                res.json().then((data) => {
                    data.sort((a, b) => a.naam.localeCompare(b.naam));
                    setDeelnemers(data);
                    const naaminputtemp = [];
                    const puntenInputtemp = [];
                    for (let a = 0; a < data.length; a++) {
                        naaminputtemp.push("");
                        puntenInputtemp.push("");
                    }
                    setdeelnemernieuwenaamInput([...naaminputtemp]);
                    setdeelnemerpunteninput([...puntenInputtemp]);
                });
            });
        }
        catch (error) { /* empty */ }
    }
    function Login() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if ((yield fetch(`http://10.10.1.90:3000/login/${adminPass}`, {
                    method: "GET",
                    credentials: "include"
                })).status == 200)
                    setIsAdmin(true);
                else
                    setIsAdmin(false);
                setAdminPass("");
            }
            catch (e) { /* empty */ }
        });
    }
    function Logout() {
        return __awaiter(this, void 0, void 0, function* () {
            yield fetch('http://10.10.1.90:3000/logout', {
                method: "GET",
                credentials: "include"
            });
            window.location.reload();
        });
    }
    function ValidateToken() {
        fetch('/api/validatetoken', {
            method: "GET",
            credentials: "include"
        }).then((res) => {
            if (res.status == 200)
                setIsAdmin(true);
            else
                setIsAdmin(false);
        });
    }
    function AddDeelnemer() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!deelnemernaamInput || !/^(?=(?:.*[a-zA-Z]){2,})[a-zA-Z\s]{1,20}$/.test(deelnemernaamInput)) {
                alert("Geen juiste naam!");
                return;
            }
            try {
                yield fetch('http://10.10.1.90:3000/addDeelnemer', {
                    method: "PUT",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ naam: deelnemernaamInput })
                }).then((res) => {
                    if (res.status == 401)
                        setIsAdmin(false);
                });
                GetAllDeenemers();
                setDeelnemernaamInput("");
            }
            catch (error) { /* empty */ }
        });
    }
    function AddPoints(index, deelnemer) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!deelnemerpunteninput[index])
                return;
            yield fetch('http://10.10.1.90:3000/updatePunten', {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ punten: deelnemer.punten + Number(deelnemerpunteninput[index]), id: deelnemer.ID, naam: deelnemer.naam })
            }).then((res) => {
                if (res.status == 401)
                    setIsAdmin(false);
            });
            GetAllDeenemers();
        });
    }
    function ChangeName(index, deelnemer) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!deelnemernieuwenaamInput[index] || !/^(?=(?:.*[a-zA-Z]){2,})[a-zA-Z\s]{1,20}$/.test(deelnemernieuwenaamInput[index])) {
                alert("Geen juiste naam!");
                return;
            }
            yield fetch('http://10.10.1.90:3000/changeName', {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ id: deelnemer.ID, newName: deelnemernieuwenaamInput[index] })
            }).then((res) => {
                if (res.status == 401)
                    setIsAdmin(false);
            });
            GetAllDeenemers();
        });
    }
    useEffect(() => {
        if (intervalCount === 0) {
            ValidateToken();
            GetAllDeenemers();
            setIntervalCount(intervalCount + 1);
        }
        const interval = setInterval(() => {
            if (intervalCount === 60)
                setIntervalCount(0);
            else
                setIntervalCount(intervalCount + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [intervalCount]);
    return (React.createElement("div", { className: "flex flex-col min-h-screen", onClick: () => { setShowpopup(false); } },
        React.createElement("div", { className: "absolute top-[10px] right-[10px]" }, isAdmin ?
            React.createElement("button", { className: "text-[14px] border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer", onClick: Logout }, "Loguit")
            :
                React.createElement(React.Fragment, null,
                    React.createElement("span", null, "Admin login:"),
                    React.createElement("input", { type: "password", value: `${adminPass}`, onChange: (event) => { setAdminPass(event.target.value); }, onKeyDown: (event) => { if (event.key == "Enter")
                            Login(); }, className: "ml-[10px] mr-[10px] bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500", placeholder: "password", required: true }),
                    React.createElement("button", { className: "text-[14px] border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer", onClick: Login }, "Login"))),
        React.createElement("div", { className: "mb-[50px] mt-[25px] flex self-center" }, isAdmin ? React.createElement(React.Fragment, null,
            React.createElement("span", { className: "text-xl" }, "deelnemer toevoegen:"),
            React.createElement("input", { type: "text", value: `${deelnemernaamInput}`, onChange: (event) => { setDeelnemernaamInput(event.target.value); }, onKeyDown: (event) => { if (event.key == "Enter")
                    AddDeelnemer(); }, className: "ml-[10px] mr-[10px] bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500", placeholder: "naam", required: true }),
            React.createElement("button", { className: "text-xl border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer", onClick: AddDeelnemer }, "deelnemer toevoegen")) : ""),
        React.createElement("div", { className: "relative overflow-y-scroll" },
            React.createElement("table", { className: "w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400" },
                React.createElement("thead", { className: "text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400" },
                    React.createElement("tr", null,
                        React.createElement("th", { scope: "col", className: "px-6 py-3" }, "Deelnemer"),
                        React.createElement("th", { scope: "col", className: "px-6 py-3" }, "Punten"),
                        isAdmin ?
                            React.createElement("th", { scope: "col", className: "px-6 py-3" }, "Acties") : "")),
                React.createElement("tbody", null, deelnemers.map((deelnemer, index) => React.createElement("tr", { className: "bg-white border-b dark:bg-gray-800 dark:border-gray-700 border-gray-200" },
                    React.createElement("th", { scope: "row", className: "px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white" }, deelnemer.naam),
                    React.createElement("td", { className: "px-6 py-4" }, deelnemer.punten),
                    isAdmin ?
                        React.createElement("td", { className: "px-6 py-4 flex justify-between" },
                            React.createElement("button", { className: "text-xl border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer", onClick: (e) => __awaiter(this, void 0, void 0, function* () {
                                    e.stopPropagation();
                                    const data = yield (yield fetch('http://10.10.1.90:3000/getHistory', {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json"
                                        },
                                        body: JSON.stringify({ naam: deelnemer.naam })
                                    })).json();
                                    setHistory([...data.map(item => (Object.assign(Object.assign({}, item), { datum: new Date(item.datum) })))]);
                                    if (selectedDeelnemer != index && showPopup)
                                        setSelectedDeelnemer(index);
                                    else {
                                        setShowpopup(!showPopup);
                                        setSelectedDeelnemer(index);
                                    }
                                }) }, "Meer info"),
                            React.createElement("div", null,
                                React.createElement("input", { type: "text", value: `${deelnemerpunteninput[index]}`, onKeyDown: (event) => { if (event.key == "Enter")
                                        AddPoints(index, deelnemer); }, onChange: (event) => {
                                        if (!/^[-]?\d*$/.test(event.target.value))
                                            return;
                                        const puntenInputTemp = deelnemerpunteninput;
                                        puntenInputTemp[index] = event.target.value;
                                        setdeelnemerpunteninput([...puntenInputTemp]);
                                    }, className: "ml-[10px] mr-[10px] bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500", placeholder: "punten", required: true }),
                                React.createElement("button", { className: "text-xl border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer", onClick: () => { AddPoints(index, deelnemer); } }, "punten toevoegen")),
                            React.createElement("div", null,
                                React.createElement("input", { type: "text", value: `${deelnemernieuwenaamInput[index]}`, onKeyDown: (event) => { if (event.key == "Enter")
                                        ChangeName(index, deelnemer); }, onChange: (event) => {
                                        const naaminputtemp = deelnemernieuwenaamInput;
                                        naaminputtemp[index] = event.target.value;
                                        setdeelnemernieuwenaamInput([...naaminputtemp]);
                                    }, className: "ml-[10px] mr-[10px] bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500", placeholder: "naam", required: true }),
                                React.createElement("button", { className: "text-xl border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer", onClick: () => { ChangeName(index, deelnemer); } }, "naam wijzigen")),
                            React.createElement("button", { className: "text-xl border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer", onClick: () => __awaiter(this, void 0, void 0, function* () {
                                    yield fetch('http://10.10.1.90:3000/removeDeelnemer', {
                                        method: "DELETE",
                                        credentials: "include",
                                        headers: {
                                            "Content-Type": "application/json"
                                        },
                                        body: JSON.stringify({ id: deelnemer.ID })
                                    }).then((res) => {
                                        if (res.status == 401)
                                            setIsAdmin(false);
                                    });
                                    GetAllDeenemers();
                                }) }, "verwijderen")) : ""))))),
        showPopup ?
            React.createElement("div", { className: "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center bg-gray-200 p-[10px] rounded-lg z-5", onClick: (e) => { e.stopPropagation(); } },
                React.createElement("span", { className: "text-xl mb-[10px]" }, deelnemers[selectedDeelnemer].naam),
                React.createElement("div", { className: "flex flex-col-reverse items-center" }, history.map((item) => React.createElement("div", { className: "flex justify-between gap-x-[10px]" },
                    React.createElement("span", null,
                        "actie: ",
                        item.actie),
                    React.createElement("span", null,
                        "datum: ",
                        date.format(item.datum, "DD/MM/YYYY hh:mm:ss")))))) : ""));
}
export default Home;
