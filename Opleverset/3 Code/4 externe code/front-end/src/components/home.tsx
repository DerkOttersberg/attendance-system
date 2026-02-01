/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import {IDeelnemers, IHistory} from '../interfaces/interfaces.ts';
import date from 'date-and-time';

function Home()
{
    const [unmodifiedData, setUnmodifiedData] = useState<IDeelnemers[]>([]);
    const [deelnemers, setDeelnemers] = useState<IDeelnemers[]>([]);
    const [deelnemernaamInput, setDeelnemernaamInput] = useState<string>("");
    const [deelnemernieuwenaamInput, setdeelnemernieuwenaamInput] = useState<string[]>([]);
    const [deelnemerpunteninput, setdeelnemerpunteninput] = useState<string[]>([]);
    const [showPopup, setShowpopup] = useState(false);
    const [selectedDeelnemer, setSelectedDeelnemer] = useState(0);
    const [history, setHistory] = useState<IHistory[]>([]);
    const [adminPass, setAdminPass] = useState<string>("");
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [intervalCount, setIntervalCount] = useState(0);
    const [isDataReversed, setIsDataReversed] = useState<boolean>(false);
    const [searchInput, setSearchInput] = useState<string>("");

    function GetAllDeenemers()
    {
        try {
            fetch(`${import.meta.env.VITE_SERVER}/allDeelnemers`, {
                    method: "GET"
                }).then((res) => {
                    res.json().then((data: IDeelnemers[]) => {
                        data.sort((a, b) => a.naam.localeCompare(b.naam));
                        setUnmodifiedData(data);
                        setDeelnemers(data);
                        const naaminputtemp: string[] = [];
                        const puntenInputtemp: string[] = [];
                        for (let a = 0; a < data.length; a++) {
                            naaminputtemp.push("");
                            puntenInputtemp.push("");  
                        }
                        setdeelnemernieuwenaamInput([...naaminputtemp]);
                        setdeelnemerpunteninput([...puntenInputtemp]);
                    });
                });
        } catch (error) { /* empty */ }
    }

    async function Login()
    {
        try
        {
            if ((await fetch(`${import.meta.env.VITE_SERVER}/login/${adminPass}`, {
                method: "GET",
                credentials: "include"
            })).status == 200) setIsAdmin(true);
            else setIsAdmin(false);
            setAdminPass("");
        } catch (e)
        { /* empty */ }
    }

    async function Logout()
    {
        await fetch(`${import.meta.env.VITE_SERVER}/logout`, {
            method: "GET",
            credentials: "include"
        });
        window.location.reload();
    }

    function ValidateToken()
    {
        fetch(`${import.meta.env.VITE_SERVER}/validatetoken`, {
            method: "GET",
            credentials: "include"
        }).then((res) => {
            if (res.status == 200) setIsAdmin(true);
            else setIsAdmin(false);
        })
    }

    async function AddDeelnemer()
    {
        if (!deelnemernaamInput || !/^(?=(?:.*[a-zA-Z]){2,})[a-zA-Z\s]{1,20}$/.test(deelnemernaamInput))
        {
            alert("Geen juiste naam!");
            return;
        }
        try {
            await fetch(`${import.meta.env.VITE_SERVER}/addDeelnemer`, {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ naam: deelnemernaamInput })
            }).then((res) => {
                if (res.status == 401) setIsAdmin(false);
            });
            GetAllDeenemers();
            setDeelnemernaamInput("");
        } catch (error) { /* empty */ }
    }

    async function AddPoints(index: number, deelnemer: IDeelnemers)
    {
        if (!deelnemerpunteninput[index]) return;
        await fetch(`${import.meta.env.VITE_SERVER}/updatePunten`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ punten: deelnemer.punten + Number(deelnemerpunteninput[index]), id: deelnemer.ID, naam: deelnemer.naam })
        }).then((res) => {
            if (res.status == 401) setIsAdmin(false);
        });

        GetAllDeenemers();
    }

    async function ChangeName(index: number, deelnemer: IDeelnemers)
    { 
        if (!deelnemernieuwenaamInput[index] || !/^(?=(?:.*[a-zA-Z]){2,})[a-zA-Z\s]{1,20}$/.test(deelnemernieuwenaamInput[index]))
        {
            alert("Geen juiste naam!");
            return;
        }
        await fetch(`${import.meta.env.VITE_SERVER}/changeName`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ id: deelnemer.ID, newName: deelnemernieuwenaamInput[index] })
        }).then((res) => {
            if (res.status == 401) setIsAdmin(false);
        });

        GetAllDeenemers();
    }

    useEffect(() => {
        if (intervalCount === 0)
        {
            ValidateToken();
            GetAllDeenemers();
            setIntervalCount(intervalCount + 1);
        }

        const interval = setInterval(() => {
            if (intervalCount === 60) setIntervalCount(0);
            else setIntervalCount(intervalCount + 1);
        }, 1000);

        return () => clearInterval(interval); 
    }, [intervalCount]);

    return (
        <div className="flex flex-col min-h-screen" onClick={() => { setShowpopup(false); }}>
            <div className="absolute top-[10px] left-[10px]">
                <span>zoeken:</span>
                <input type="text" value={`${searchInput}`} onChange={(event: { target: { value: any; }; }) =>
                {
                    setSearchInput(event.target.value);
                    if (event.target.value == "")
                    {
                        const naaminputtemp: string[] = [];
                        const puntenInputtemp: string[] = [];
                        for (let a = 0; a < unmodifiedData.length; a++)
                        {
                            naaminputtemp.push("");
                            puntenInputtemp.push("");
                        }
                        setdeelnemernieuwenaamInput([...naaminputtemp]);
                        setdeelnemerpunteninput([...puntenInputtemp]);
                        setDeelnemers(unmodifiedData);
                        return;
                    }
                    const filtered: IDeelnemers[] = [
                        ...unmodifiedData.filter((data: IDeelnemers) => data.naam.toLowerCase().includes(event.target.value.toLowerCase())),
                        ...unmodifiedData.filter((data: IDeelnemers) => data.punten.toString().includes(event.target.value)),
                    ];

                    const uniqueFiltered = Array.from(new Map(filtered.map(item => [item.naam, item])).values());

                    const naaminputtemp: string[] = [];
                    const puntenInputtemp: string[] = [];
                    for (let a = 0; a < uniqueFiltered.length; a++)
                    {
                        naaminputtemp.push("");
                        puntenInputtemp.push("");
                    }
                    setdeelnemernieuwenaamInput([...naaminputtemp]);
                    setdeelnemerpunteninput([...puntenInputtemp]);
                    setDeelnemers(uniqueFiltered);

                }}></input>
            </div>
            <div className="absolute top-[10px] right-[10px]">
                {isAdmin ? 
                    <button className="text-[14px] border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer" onClick={Logout}>Loguit</button>
                    :
                    <>
                        <span>Admin login:</span>
                        <input type="password" value={`${adminPass}`} onChange={(event: { target: { value: any; }; }) => { setAdminPass(event.target.value) }} onKeyDown={(event: { key: string; }) => { if (event.key == "Enter") Login(); }} className="ml-[10px] mr-[10px] bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500" placeholder="password" required />
                        <button className="text-[14px] border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer" onClick={Login}>Login</button>
                    </>              
                }
            </div>
            <div className="mb-[50px] mt-[25px] flex self-center">
                {isAdmin ? <>
                    <span className="text-xl">deelnemer toevoegen:</span>
                    <input type="text" value={`${deelnemernaamInput}`} onChange={(event: { target: { value: any; }; }) => { setDeelnemernaamInput(event.target.value) }} onKeyDown={(event: { key: string; }) => { if (event.key == "Enter") AddDeelnemer(); }} className="ml-[10px] mr-[10px] bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500" placeholder="naam" required />
                    <button className="text-xl border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer" onClick={AddDeelnemer}>deelnemer toevoegen</button>
                </> : ""
                }
            
            </div>          
            <div className="relative overflow-y-scroll">
                <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() =>
                            {
                                setDeelnemers([...deelnemers.sort((a: { naam: string; }, b: { naam: string; }) => isDataReversed ? a.naam.localeCompare(b.naam) : b.naam.localeCompare(a.naam))]);
                                setIsDataReversed(!isDataReversed);
                            }}>
                                Deelnemer
                            </th>
                            <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() =>
                            {
                                setDeelnemers([...deelnemers.sort((a: { punten: number; }, b: { punten: number; }) => isDataReversed ? a.punten - b.punten : b.punten - a.punten)]);
                                setIsDataReversed(!isDataReversed);
                            }}>
                                Punten
                            </th>
                            {isAdmin ?
                                <th scope="col" className="px-6 py-3">
                                    Acties
                                </th> : ""}
                        </tr>
                    </thead>
                    <tbody>
                        {deelnemers.map((deelnemer: IDeelnemers, index: number) => 
                        <tr className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 border-gray-200">
                            <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                {deelnemer.naam}
                            </th>
                            <td className="px-6 py-4">
                                {deelnemer.punten}
                            </td>
                                {isAdmin ?
                                    <td className="px-6 py-4 flex justify-between">
                                        <button className="text-xl border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer" onClick={async (e: { stopPropagation: () => void; }) =>
                                        {
                                            e.stopPropagation();

                                            const data: IHistory[] = await (await fetch(`${import.meta.env.VITE_SERVER}/getHistory`, {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type": "application/json"
                                                },
                                                body: JSON.stringify({ naam: deelnemer.naam })
                                            })).json();

                                            setHistory([...data.map(item => ({
                                                ...item,
                                                datum: new Date(item.datum)
                                            }))]);

                                            if (selectedDeelnemer != index && showPopup) setSelectedDeelnemer(index);
                                            else
                                            {
                                                setShowpopup(!showPopup);
                                                setSelectedDeelnemer(index);
                                            }
                                        }}>Meer info</button>
                                        <div>
                                            <input type="text" value={`${deelnemerpunteninput[index]}`} onKeyDown={(event: { key: string; }) => { if (event.key == "Enter") AddPoints(index, deelnemer); }} onChange={(event: { target: { value: string; }; }) =>
                                            {
                                                if (!/^[-]?\d*$/.test(event.target.value)) return;
                                                const puntenInputTemp = deelnemerpunteninput;
                                                puntenInputTemp[index] = event.target.value;
                                                setdeelnemerpunteninput([...puntenInputTemp]);
                                            }} className="ml-[10px] mr-[10px] bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500" placeholder="punten" required />
                                            <button className="text-xl border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer" onClick={() => {AddPoints(index, deelnemer)}}>punten toevoegen</button>
                                        </div>
                                        <div>
                                            <input type="text" value={`${deelnemernieuwenaamInput[index]}`} onKeyDown={(event: { key: string; }) => { if (event.key == "Enter") ChangeName(index, deelnemer); }} onChange={(event: { target: { value: any; }; }) =>
                                            {
                                                const naaminputtemp = deelnemernieuwenaamInput;
                                                naaminputtemp[index] = event.target.value;
                                                setdeelnemernieuwenaamInput([...naaminputtemp]);
                                            }} className="ml-[10px] mr-[10px] bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500" placeholder="naam" required />
                                            <button className="text-xl border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer" onClick={() => { ChangeName(index, deelnemer) }}>naam wijzigen</button>
                                        </div>
                                        <button className="text-xl border border-gray-300 bg-gray-50 rounded-lg p-[2px] cursor-pointer" onClick={async () =>
                                        {
                                            await fetch(`${import.meta.env.VITE_SERVER}/removeDeelnemer`, {
                                                method: "DELETE",
                                                credentials: "include",
                                                headers: {
                                                    "Content-Type": "application/json"
                                                },
                                                body: JSON.stringify({ id: deelnemer.ID })
                                            }).then((res) => {
                                                if (res.status == 401) setIsAdmin(false);
                                            });
                                            GetAllDeenemers();
                                        }}>verwijderen</button>
                                    </td> : ""}
                        </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showPopup ? 
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center bg-gray-200 p-[10px] rounded-lg z-5" onClick={(e: { stopPropagation: () => void; }) => {e.stopPropagation();}}>
                <span className="text-xl mb-[10px]">{deelnemers[selectedDeelnemer].naam}</span>
                    <div className="flex flex-col-reverse items-center">
                        {history.map((item: { actie: any; datum: Date; })=>
                        <div className="flex justify-between gap-x-[10px]">
                            <span>actie: {item.actie}</span>
                            <span>datum: {date.format(item.datum, "DD/MM/YYYY hh:mm:ss")}</span>
                        </div> 
                        )}
                    </div>   
            </div> : ""}
        </div>
    )
}

export default Home;
