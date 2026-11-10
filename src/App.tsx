import React, { useState, useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import QRCode from "react-qr-code";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDcNRlckNpXTWiyF1UU-1t6S0ZL76AGlHA",
  authDomain: "inventario-moncada.firebaseapp.com",
  projectId: "inventario-moncada",
  storageBucket: "inventario-moncada.firebasestorage.app",
  messagingSenderId: "445305893114",
  appId: "1:445305893114:web:0f951910fb899c5b051943",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const LOGO_URL = "/logo.png"; 

// --- ÍCONOS SVG ---
const LockIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
  </svg>
);
const UnlockIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
  </svg>
);
const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
  </svg>
);
const QRIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
  </svg>
);
const DocIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export default function App() {
  const [products, setProducts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("empleado");
  const [showModal, setShowModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectSheetData, setProjectSheetData] = useState({
    project: "",
    location: "",
    date: new Date().toISOString().split("T")[0],
  });

  const scannerRef = useRef<any>(null);
  const [scannerMode, setScannerMode] = useState<"search" | "serial" | null>(null);

  const [actionModal, setActionModal] = useState({
    show: false,
    type: "",
    product: null as any,
  });

  const [formData, setFormData] = useState({
    docId: "", id: "", name: "", brand: "", model: "", serial: "", location: "", stock: 0, observations: "", image: "",
  });
  
  const [actionData, setActionData] = useState({ qty: 1, user: "", reason: "" });

  const PIN_ADMIN = "1234";

  const handleImageChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event: any) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_WIDTH = 300;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setFormData((prev: any) => ({ ...prev, image: canvas.toDataURL("image/jpeg", 0.7) }));
      };
    };
  };

  useEffect(() => {
    if (scannerMode) {
      const timer = setTimeout(() => {
        const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
        scannerRef.current = scanner;
        scanner.render(
          (decodedText) => {
            if (scannerMode === "search") setSearch(decodedText);
            else if (scannerMode === "serial") setFormData((prev: any) => ({ ...prev, serial: decodedText }));
            setScannerMode(null);
          },
          () => {}
        );
      }, 150);
      return () => { clearTimeout(timer); if (scannerRef.current) try { scannerRef.current.clear(); } catch (error) {} };
    }
  }, [scannerMode]);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, "inventario"), (snapshot) => {
      setProducts(snapshot.docs.map((doc) => ({ ...doc.data(), docId: doc.id })));
    });
    const unsubHistory = onSnapshot(query(collection(db, "movimientos"), orderBy("date", "desc")), (snapshot) => {
      setHistory(snapshot.docs.map((doc) => ({ ...doc.data(), docId: doc.id })));
    });
    return () => { unsubProducts(); unsubHistory(); };
  }, []);

  const toggleRole = () => {
    if (role === "admin") setRole("empleado");
    else {
      const pin = prompt("Ingrese el PIN de Administrador:");
      if (pin === PIN_ADMIN) setRole("admin");
      else if (pin !== null) alert("PIN Incorrecto");
    }
  };

  const handleSaveProduct = async (e: any) => {
    e.preventDefault();
    if (formData.docId) await updateDoc(doc(db, "inventario", formData.docId), formData);
    else await addDoc(collection(db, "inventario"), { ...formData, id: "PRD-" + Math.random().toString(36).substr(2, 9).toUpperCase() });
    setShowModal(false);
  };

  const handleDelete = async (docId: any) => {
    if (window.confirm("¿Estás seguro de eliminar este producto?")) await deleteDoc(doc(db, "inventario", docId));
  };

  const handleAction = async (e: any) => {
    e.preventDefault();
    if (actionData.user.trim() === "") return alert("⚠️ OBLIGATORIO: Debes escribir el nombre del Empleado o Responsable.");
    if (actionData.reason.trim() === "") return alert("⚠️ OBLIGATORIO: Debes escribir el Motivo o Proyecto.");
    
    const product = actionModal.product;
    const newStock = actionModal.type === "Entrada" ? Number(product.stock) + Number(actionData.qty) : Number(product.stock) - Number(actionData.qty);
    if (newStock < 0) return alert("No hay suficiente stock para esta salida.");

    await updateDoc(doc(db, "inventario", product.docId), { stock: newStock });
    await addDoc(collection(db, "movimientos"), {
      productName: product.name, productId: product.id, type: actionModal.type, qty: actionData.qty,
      user: actionData.user, reason: actionData.reason, date: new Date().toISOString(),
    });
    setActionModal({ show: false, type: "", product: null });
    setActionData({ qty: 1, user: "", reason: "" });
  };

  // --- ETIQUETA TÉRMICA 2x1 (CÓDIGO BLINDADO PARA EVITAR CORTES Y CAMBIOS DE TAMAÑO) ---
  const printLabel = (p: any) => {
    const printWindow = window.open("", "_blank", "width=400,height=300");
    if (!printWindow) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${p.id}`;
    printWindow.document.write(`
      <html>
        <head>
          <title>${p.id}</title>
          <style>
            /* Forzamos el tamaño exacto en milímetros (50x25mm = 2x1 pulgadas) y quitamos todo margen del navegador */
            @page { size: 50mm 25mm; margin: 0mm !important; padding: 0mm !important; }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 50mm !important;
              height: 25mm !important;
              font-family: Arial, sans-serif;
              background: white;
              overflow: hidden; /* Evita que se cree una segunda página en blanco */
              box-sizing: border-box;
            }
            .label-container {
              width: 50mm;
              height: 25mm;
              display: flex;
              padding: 2mm; /* Margen interno seguro para que no se corte el texto */
              box-sizing: border-box;
              align-items: center;
              overflow: hidden;
            }
            .qr-section { width: 35%; display: flex; align-items: center; justify-content: center; }
            .qr-section img { width: 100%; height: auto; max-height: 21mm; object-fit: contain; }
            .text-section { width: 65%; padding-left: 2mm; display: flex; flex-direction: column; justify-content: center; overflow: hidden; }
            .header { font-size: 7px; font-weight: bold; border-bottom: 1px solid black; margin-bottom: 1px; padding-bottom: 1px; }
            .title { font-size: 10px; font-weight: bold; margin-bottom: 1px; line-height: 1.1; max-height: 22px; overflow: hidden; }
            .detail { font-size: 8px; margin-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="qr-section"><img src="${qrUrl}" /></div>
            <div class="text-section">
              <div class="header">INVENTARIO MONCADA</div>
              <div class="title">${p.name}</div>
              <div class="detail">ID: ${p.id}</div>
              <div class="detail">Ubic: ${p.location || 'Almacén'}</div>
            </div>
          </div>
          <script>setTimeout(() => { window.print(); window.close(); }, 800);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printProjectSheet = (data: { project: string, location: string, date: string }) => {
    const projectItems = history.filter((m) => m.type === "Salida" && m.reason.toLowerCase().trim() === data.project.toLowerCase().trim());
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    const absoluteLogoUrl = window.location.origin + LOGO_URL;
    let rows = "";

    if (projectItems.length > 0) {
      rows = projectItems.map(m => `
        <tr>
          <td style="padding: 10px; border: 1px solid #000; text-align: center;">${new Date(m.date).toLocaleDateString()}</td>
          <td style="padding: 10px; border: 1px solid #000; font-weight: bold;">${m.productName}</td>
          <td style="padding: 10px; border: 1px solid #000; text-align: center; font-size: 1.1em; font-weight: bold;">${m.qty}</td>
          <td style="padding: 10px; border: 1px solid #000; text-align: center;">${m.user}</td>
        </tr>
      `).join('');
    } else {
      for (let i = 0; i < 8; i++) {
        rows += `<tr><td style="padding: 16px; border: 1px solid #000;"></td><td style="padding: 16px; border: 1px solid #000;"></td><td style="padding: 16px; border: 1px solid #000;"></td><td style="padding: 16px; border: 1px solid #000;"></td></tr>`;
      }
    }

    const [year, month, day] = data.date.split('-');
    const formattedDate = `${day}/${month}/${year}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Hoja de Salida - ${data.project}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #7c2d2c; padding-bottom: 20px; margin-bottom: 30px; }
            .header-logo { width: 30%; text-align: left; }
            .header-logo img { max-width: 100%; max-height: 70px; object-fit: contain; }
            .header-text { width: 40%; text-align: center; }
            .header-spacer { width: 30%; }
            h1 { margin: 0; color: #7c2d2c; font-size: 20px; letter-spacing: 1px; }
            h2 { margin: 8px 0 0 0; color: #4b5563; font-size: 14px; }
            .info-section { background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 30px; font-size: 16px; line-height: 1.6; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 60px; font-size: 14px; }
            th { background-color: #7c2d2c; color: white; padding: 12px; border: 1px solid #000; text-align: center; }
            .signatures { display: flex; justify-content: space-between; margin-top: 80px; padding: 0 20px; }
            .sig-box { width: 40%; text-align: center; border-top: 2px solid #000; padding-top: 10px; font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="header-logo"><img src="${absoluteLogoUrl}" alt="Logo Moncada" /></div>
            <div class="header-text"><h1>INVENTARIO MONCADA</h1><h2>HOJA DE RESGUARDO Y SALIDA DE MATERIAL</h2></div>
            <div class="header-spacer"></div>
          </div>
          <div class="info-section">
            <div class="info-grid">
              <div><strong>Proyecto / Motivo:</strong> <span style="text-transform: uppercase;">${data.project}</span></div>
              <div style="text-align: right;"><strong>Fecha:</strong> ${formattedDate}</div>
            </div>
            <div style="margin-top: 10px;"><strong>Ubicación / Destino:</strong> <span style="text-transform: uppercase;">${data.location || '_____________________________________________'}</span></div>
          </div>
          <table><thead><tr><th style="width: 15%;">Fecha</th><th style="width: 45%;">Descripción del Producto</th><th style="width: 15%;">Cantidad</th><th style="width: 25%;">Responsable (Firma)</th></tr></thead><tbody>${rows}</tbody></table>
          <div class="signatures">
            <div class="sig-box">ENTREGÓ (Almacén)</div>
            <div class="sig-box">RECIBIÓ (Responsable del Proyecto)</div>
          </div>
          <script>setTimeout(() => { window.print(); window.close(); }, 1200);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyMovements = history.filter((m) => {
    const d = new Date(m.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalEntradas = monthlyMovements.filter((m) => m.type === "Entrada").reduce((acc, curr) => acc + Number(curr.qty), 0);
  const totalSalidas = monthlyMovements.filter((m) => m.type === "Salida").reduce((acc, curr) => acc + Number(curr.qty), 0);

  const exportMonthlyReport = () => {
    let csv = "Fecha,Tipo,Producto,Cantidad,Empleado,Motivo\n";
    monthlyMovements.forEach((m) => { csv += `${new Date(m.date).toLocaleDateString()},${m.type},${m.productName},${m.qty},${m.user},${m.reason}\n`; });
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Reporte_Mensual_${currentMonth + 1}_${currentYear}.csv`;
    a.click();
  };

  const uniqueProjects = Array.from(new Set(history.filter(m => m.type === "Salida").map(m => m.reason))).sort();

  const normalizeText = (text: any) => (text || "").toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const searchTerms = normalizeText(search).split(" ").filter((t: string) => t.length > 0);
  const filteredProducts = products.filter((p) => {
    if (searchTerms.length === 0) return true;
    const productDataCombined = normalizeText(`${p.name} ${p.id} ${p.brand} ${p.model} ${p.serial} ${p.location} ${p.observations}`);
    return searchTerms.every((term: string) => productDataCombined.includes(term));
  });

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-4xl mx-auto bg-white p-4 rounded-xl shadow mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inventario Moncada</h1>
          <p className="text-sm text-gray-500 uppercase tracking-wide">
            Modo: <span className={role === "admin" ? "text-blue-600 font-bold" : "text-green-600 font-bold"}>{role}</span>
          </p>
        </div>
        <button onClick={toggleRole} className={`p-2 rounded-full text-white ${role === "admin" ? "bg-blue-600" : "bg-gray-400"}`}>
          {role === "admin" ? <UnlockIcon /> : <LockIcon />}
        </button>
      </div>

      <div className="max-w-4xl mx-auto mb-6 flex flex-wrap gap-2">
        <div className="flex-1 flex gap-2">
          <input type="text" placeholder="Buscar producto, marca, serie, ubicación o ID..." className="w-full border p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={() => setScannerMode("search")} className="bg-gray-800 text-white p-3 rounded-lg flex items-center gap-2 hover:bg-gray-900 transition-colors"><QRIcon /> <span className="hidden sm:inline">Escanear</span></button>
        </div>
      </div>

      {role === "admin" && (
        <div className="max-w-4xl mx-auto mb-6 flex flex-wrap gap-3">
          <button onClick={() => { setFormData({ docId: "", id: "", name: "", brand: "", model: "", serial: "", location: "", stock: 0, observations: "", image: "" }); setShowModal(true); }} className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2 rounded shadow font-bold hover:bg-blue-700 transition-colors text-center">+ Nuevo Producto</button>
          
          <button onClick={() => { 
            setProjectSheetData({ project: "", location: "", date: new Date().toISOString().split("T")[0] });
            setShowProjectModal(true); 
          }} className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-2 rounded shadow flex items-center justify-center gap-2 font-bold hover:bg-indigo-700 transition-colors">
            <DocIcon /> Vale Salida
          </button>

          <button onClick={() => setShowReportModal(true)} className="flex-1 sm:flex-none bg-purple-600 text-white px-4 py-2 rounded shadow flex items-center justify-center gap-2 font-bold hover:bg-purple-700 transition-colors"><ChartIcon /> Reporte del Mes</button>
        </div>
      )}

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProducts.map((p) => (
          <div key={p.id} className="bg-white p-4 rounded-xl shadow-md border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-800">{p.name}</h3>
                <p className="text-xs text-gray-400 mb-2">{p.id}</p>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><b>Marca:</b> {p.brand}</p>
                  <p><b>Modelo:</b> {p.model}</p>
                  <p><b>Serie original:</b> {p.serial}</p>
                  <p><b>Ubicación:</b> {p.location}</p>
                  <p className="text-lg mt-2"><b>Stock:</b> <span className={p.stock < 5 ? "text-red-500 font-bold" : "text-green-600 font-bold"}>{p.stock} piezas</span></p>
                </div>
              </div>
              <div className="flex gap-2">
                {p.image && <img src={p.image} alt={p.name} className="w-24 h-24 object-cover rounded-lg border shadow-sm" />}
                <div className="flex flex-col items-center bg-gray-50 p-2 rounded-lg border shadow-sm">
                  <QRCode value={p.id} size={70} />
                  {role === "admin" && <button onClick={() => printLabel(p)} className="mt-2 bg-gray-800 text-white text-[10px] font-bold py-1 px-2 rounded w-full hover:bg-gray-900 transition-colors">🖨️ Etiqueta</button>}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <button onClick={() => setActionModal({ show: true, type: "Entrada", product: p })} className="flex-1 bg-green-100 text-green-700 py-2 rounded font-bold hover:bg-green-200 transition-colors">+ Entrada</button>
              <button onClick={() => setActionModal({ show: true, type: "Salida", product: p })} className="flex-1 bg-orange-100 text-orange-700 py-2 rounded font-bold hover:bg-orange-200 transition-colors">- Salida</button>
            </div>

            {role === "admin" && (
              <div className="mt-2 flex gap-2">
                <button onClick={() => { setFormData({ docId: p.docId || "", id: p.id || "", name: p.name || "", brand: p.brand || "", model: p.model || "", serial: p.serial || "", location: p.location || "", stock: p.stock || 0, observations: p.observations || "", image: p.image || "" }); setShowModal(true); }} className="flex-1 text-blue-600 border border-blue-200 py-1 rounded text-sm hover:bg-blue-50 transition-colors">Editar</button>
                <button onClick={() => handleDelete(p.docId)} className="flex-1 text-red-600 border border-red-200 py-1 rounded text-sm hover:bg-red-50 transition-colors">Eliminar</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {scannerMode && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white p-4 rounded-xl w-full max-w-md flex flex-col items-center shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-center text-gray-800">{scannerMode === "search" ? "Enfoca el código del producto" : "Enfoca la serie original"}</h2>
            <div id="reader" className="w-full bg-gray-100 rounded-lg overflow-hidden border-2 border-dashed border-gray-300"></div>
            <button onClick={() => setScannerMode(null)} className="mt-6 w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition-colors shadow">Cerrar Cámara</button>
          </div>
        </div>
      )}

      {showProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Generar Vale de Salida</h2>
              <button onClick={() => setShowProjectModal(false)} className="text-gray-500 font-bold text-2xl hover:text-gray-800">&times;</button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Ingresa los datos para tu hoja membretada. Si escribes un proyecto nuevo, se imprimirá un formato en blanco para llenar a mano.</p>
            <form onSubmit={(e) => { e.preventDefault(); printProjectSheet(projectSheetData); setShowProjectModal(false); }} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1 text-gray-700">Proyecto / Motivo <span className="text-red-500">*</span></label>
                <input type="text" list="project-list" required placeholder="Escribe el proyecto..." className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={projectSheetData.project} onChange={(e) => setProjectSheetData({ ...projectSheetData, project: e.target.value })} />
                <datalist id="project-list">{uniqueProjects.map(proj => <option key={proj as string} value={proj as string} />)}</datalist>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-gray-700">Ubicación / Dirección</label>
                <input type="text" placeholder="Ej. Av. Central 123" className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={projectSheetData.location} onChange={(e) => setProjectSheetData({ ...projectSheetData, location: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-gray-700">Fecha de la hoja</label>
                <input type="date" required className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={projectSheetData.date} onChange={(e) => setProjectSheetData({ ...projectSheetData, date: e.target.value })} />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg shadow hover:bg-indigo-700 transition-colors mt-2">🖨️ Imprimir Formato</button>
            </form>
          </div>
        </div>
      )}

      {actionModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h2 className={`text-xl font-bold mb-4 ${actionModal.type === "Entrada" ? "text-green-600" : "text-orange-600"}`}>Registrar {actionModal.type}</h2>
            <p className="mb-4 text-gray-600 font-bold">{actionModal.product.name}</p>
            <form onSubmit={handleAction} className="space-y-3">
              <div>
                <label className="block text-sm font-bold">Cantidad <span className="text-red-500">*</span></label>
                <input type="number" min="1" required className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={actionData.qty} onChange={(e) => setActionData({ ...actionData, qty: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm font-bold">Empleado / Responsable <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Ej. Juan Pérez" required className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={actionData.user} onChange={(e) => setActionData({ ...actionData, user: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-bold">Motivo / Proyecto <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Ej. Instalación en Torre B" required className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={actionData.reason} onChange={(e) => setActionData({ ...actionData, reason: e.target.value })} />
              </div>
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setActionModal({ show: false, type: "", product: null as any })} className="flex-1 bg-gray-200 p-2 rounded font-bold hover:bg-gray-300">Cancelar</button>
                <button type="submit" className={`flex-1 text-white p-2 rounded font-bold shadow ${actionModal.type === "Entrada" ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"}`}>Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-purple-700">Resumen del Mes</h2>
              <button onClick={() => setShowReportModal(false)} className="text-gray-500 font-bold text-xl hover:text-gray-800">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-100 p-4 rounded-lg text-center border border-green-200">
                <p className="text-sm text-green-700 font-bold uppercase">Total Entradas</p>
                <p className="text-3xl font-black text-green-600">+{totalEntradas}</p>
              </div>
              <div className="bg-orange-100 p-4 rounded-lg text-center border border-orange-200">
                <p className="text-sm text-orange-700 font-bold uppercase">Total Salidas</p>
                <p className="text-3xl font-black text-orange-600">-{totalSalidas}</p>
              </div>
            </div>
            <button onClick={exportMonthlyReport} className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg shadow hover:bg-purple-700 transition-colors">Descargar Excel (CSV)</button>
          </div>
        </div>
      )}
    </div>
  );
}
