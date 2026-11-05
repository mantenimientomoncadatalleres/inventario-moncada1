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
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
  </svg>
);
const QRIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
  </svg>
);

export default function App() {
  const [products, setProducts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("empleado");
  const [showModal, setShowModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  
  const scannerRef = useRef<any>(null);
  const [scannerMode, setScannerMode] = useState<"search" | "serial" | null>(null);

  const [actionModal, setActionModal] = useState({
    show: false,
    type: "",
    product: null as any,
  });

  const [formData, setFormData] = useState({
    docId: "",
    id: "",
    name: "",
    brand: "",
    model: "",
    serial: "",
    location: "",
    stock: 0,
    observations: "",
    image: "",
  });
  
  const [actionData, setActionData] = useState({
    qty: 1,
    user: "",
    reason: "",
  });

  const PIN_ADMIN = "1234";

  const handleImageChange = (e: any) => {
    const file = e.target.files[0];
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
        
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        setFormData((prev: any) => ({ ...prev, image: compressedBase64 }));
      };
    };
  };

  useEffect(() => {
    if (scannerMode) {
      const timer = setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          "reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
        scannerRef.current = scanner;
        scanner.render(
          (decodedText) => {
            if (scannerMode === "search") {
              setSearch(decodedText);
            } else if (scannerMode === "serial") {
              setFormData((prev: any) => ({ ...prev, serial: decodedText }));
            }
            setScannerMode(null);
          },
          (err) => {}
        );
      }, 150);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          try {
            scannerRef.current.clear();
          } catch (e) {}
        }
      };
    }
  }, [scannerMode]);

  useEffect(() => {
    const unsubProducts = onSnapshot(
      collection(db, "inventario"),
      (snapshot) => {
        setProducts(
          snapshot.docs.map((doc) => ({ ...doc.data(), docId: doc.id }))
        );
      }
    );
    const unsubHistory = onSnapshot(
      query(collection(db, "movimientos"), orderBy("date", "desc")),
      (snapshot) => {
        setHistory(
          snapshot.docs.map((doc) => ({ ...doc.data(), docId: doc.id }))
        );
      }
    );
    return () => {
      unsubProducts();
      unsubHistory();
    };
  }, []);

  const toggleRole = () => {
    if (role === "admin") {
      setRole("empleado");
    } else {
      const pin = prompt("Ingrese el PIN de Administrador:");
      if (pin === PIN_ADMIN) {
        setRole("admin");
      } else if (pin !== null) {
        alert("PIN Incorrecto");
      }
    }
  };

  const handleSaveProduct = async (e: any) => {
    e.preventDefault();
    if (formData.docId) {
      await updateDoc(doc(db, "inventario", formData.docId), formData);
    } else {
      await addDoc(collection(db, "inventario"), {
        ...formData,
        id: "PRD-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      });
    }
    setShowModal(false);
  };

  const handleDelete = async (docId: any) => {
    if (window.confirm("¿Estás seguro de eliminar este producto?")) {
      await deleteDoc(doc(db, "inventario", docId));
    }
  };

  const handleAction = async (e: any) => {
    e.preventDefault();

    if (actionData.user.trim() === "") {
      alert("⚠️ OBLIGATORIO: Debes escribir el nombre del Empleado o Responsable.");
      return;
    }
    if (actionData.reason.trim() === "") {
      alert("⚠️ OBLIGATORIO: Debes escribir el Motivo o Proyecto.");
      return;
    }

    const product = actionModal.product;
    const newStock =
      actionModal.type === "Entrada"
        ? Number(product.stock) + Number(actionData.qty)
        : Number(product.stock) - Number(actionData.qty);

    if (newStock < 0) return alert("No hay suficiente stock para esta salida.");

    await updateDoc(doc(db, "inventario", product.docId), { stock: newStock });

    await addDoc(collection(db, "movimientos"), {
      productName: product.name,
      productId: product.id,
      type: actionModal.type,
      qty: actionData.qty,
      user: actionData.user,
      reason: actionData.reason,
      date: new Date().toISOString(),
    });

    setActionModal({ show: false, type: "", product: null });
    setActionData({ qty: 1, user: "", reason: "" });
  };

  const printLabel = (p: any) => {
    const printWindow = window.open("", "_blank", "width=600,height=400");
    if (!printWindow) return;
    
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${p.id}`;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Etiqueta - ${p.id}</title>
          <style>
            @page { size: 2in 1in; margin: 0; }
            body {
              margin: 0;
              padding: 0;
              width: 2in;
              height: 1in;
              font-family: Arial, sans-serif;
              background: white;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .label-container {
              width: 100%;
              height: 100%;
              display: flex;
              padding: 4px;
              box-sizing: border-box;
            }
            .qr-section {
              width: 0.8in;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-section img {
              width: 100%;
              height: auto;
            }
            .text-section {
              flex: 1;
              padding-left: 6px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              overflow: hidden;
            }
            .header { font-size: 7px; font-weight: bold; border-bottom: 1px solid black; margin-bottom: 3px; padding-bottom: 2px; }
            .title { font-size: 11px; font-weight: bold; margin-bottom: 3px; line-height: 1; max-height: 22px; overflow: hidden; }
            .detail { font-size: 9px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="qr-section">
              <img src="${qrUrl}" />
            </div>
            <div class="text-section">
              <div class="header">INVENTARIO MONCADA</div>
              <div class="title">${p.name}</div>
              <div class="detail">ID: ${p.id}</div>
              <div class="detail">Ubic: ${p.location || 'Almacén'}</div>
            </div>
          </div>
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 800);
          </script>
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

  const totalEntradas = monthlyMovements
    .filter((m) => m.type === "Entrada")
    .reduce((acc, curr) => acc + Number(curr.qty), 0);
  const totalSalidas = monthlyMovements
    .filter((m) => m.type === "Salida")
    .reduce((acc, curr) => acc + Number(curr.qty), 0);

  const exportMonthlyReport = () => {
    let csv = "Fecha,Tipo,Producto,Cantidad,Empleado,Motivo\n";
    monthlyMovements.forEach((m) => {
      csv += `${new Date(m.date).toLocaleDateString()},${m.type},${
        m.productName
      },${m.qty},${m.user},${m.reason}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Reporte_Mensual_${currentMonth + 1}_${currentYear}.csv`;
    a.click();
  };

  // --- FILTRO INTELIGENTE ACTUALIZADO ---
  const filteredProducts = products.filter(
    (p) =>
      (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.serial || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.id || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.brand || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.location || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-4xl mx-auto bg-white p-4 rounded-xl shadow mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inventario Moncada</h1>
          <p className="text-sm text-gray-500 uppercase tracking-wide">
            Modo:{" "}
            <span className={role === "admin" ? "text-blue-600 font-bold" : "text-green-600 font-bold"}>
              {role}
            </span>
          </p>
        </div>
        <button
          onClick={toggleRole}
          className={`p-2 rounded-full text-white ${role === "admin" ? "bg-blue-600" : "bg-gray-400"}`}
        >
          {role === "admin" ? <UnlockIcon /> : <LockIcon />}
        </button>
      </div>

      <div className="max-w-4xl mx-auto mb-6 flex flex-wrap gap-2">
        <div className="flex-1 flex gap-2">
          {/* --- PLACEHOLDER DE LA BARRA ACTUALIZADO --- */}
          <input
            type="text"
            placeholder="Buscar producto, marca, serie, ubicación o ID..."
            className="w-full border p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => setScannerMode("search")}
            className="bg-gray-800 text-white p-3 rounded-lg flex items-center gap-2 hover:bg-gray-900 transition-colors"
          >
            <QRIcon /> <span className="hidden sm:inline">Escanear</span>
          </button>
        </div>
      </div>

      {role === "admin" && (
        <div className="max-w-4xl mx-auto mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => {
              setFormData({
                docId: "",
                id: "",
                name: "",
                brand: "",
                model: "",
                serial: "",
                location: "",
                stock: 0,
                observations: "",
                image: "",
              });
              setShowModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded shadow font-bold hover:bg-blue-700 transition-colors"
          >
            + Nuevo Producto
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded shadow flex items-center gap-2 font-bold hover:bg-purple-700 transition-colors"
          >
            <ChartIcon /> Reporte del Mes
          </button>
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
                  <p className="text-lg mt-2">
                    <b>Stock:</b>{" "}
                    <span className={p.stock < 5 ? "text-red-500 font-bold" : "text-green-600 font-bold"}>
                      {p.stock} piezas
                    </span>
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                {p.image && (
                  <img 
                    src={p.image} 
                    alt={p.name} 
                    className="w-24 h-24 object-cover rounded-lg border shadow-sm"
                  />
                )}
                <div className="flex flex-col items-center bg-gray-50 p-2 rounded-lg border shadow-sm">
                  <QRCode value={p.id} size={70} />
                  {role === "admin" && (
                    <button
                      onClick={() => printLabel(p)}
                      className="mt-2 bg-gray-800 text-white text-[10px] font-bold py-1 px-2 rounded w-full hover:bg-gray-900 transition-colors"
                    >
                      🖨️ Etiqueta
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <button
                onClick={() => setActionModal({ show: true, type: "Entrada", product: p })}
                className="flex-1 bg-green-100 text-green-700 py-2 rounded font-bold hover:bg-green-200 transition-colors"
              >
                + Entrada
              </button>
              <button
                onClick={() => setActionModal({ show: true, type: "Salida", product: p })}
                className="flex-1 bg-orange-100 text-orange-700 py-2 rounded font-bold hover:bg-orange-200 transition-colors"
              >
                - Salida
              </button>
            </div>

            {role === "admin" && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    setFormData({
                      docId: p.docId || "",
                      id: p.id || "",
                      name: p.name || "",
                      brand: p.brand || "",
                      model: p.model || "",
                      serial: p.serial || "",
                      location: p.location || "",
                      stock: p.stock || 0,
                      observations: p.observations || "",
                      image: p.image || "", 
                    });
                    setShowModal(true);
                  }}
                  className="flex-1 text-blue-600 border border-blue-200 py-1 rounded text-sm hover:bg-blue-50 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(p.docId)}
                  className="flex-1 text-red-600 border border-red-200 py-1 rounded text-sm hover:bg-red-50 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {scannerMode && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white p-4 rounded-xl w-full max-w-md flex flex-col items-center shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-center text-gray-800">
              {scannerMode === "search" ? "Enfoca el código del producto" : "Enfoca la serie original"}
            </h2>
            <div id="reader" className="w-full bg-gray-100 rounded-lg overflow-hidden border-2 border-dashed border-gray-300"></div>
            <button
              onClick={() => setScannerMode(null)}
              className="mt-6 w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition-colors shadow"
            >
              Cerrar Cámara
            </button>
          </div>
        </div>
      )}

      {actionModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h2 className={`text-xl font-bold mb-4 ${actionModal.type === "Entrada" ? "text-green-600" : "text-orange-600"}`}>
              Registrar {actionModal.type}
            </h2>
            <p className="mb-4 text-gray-600 font-bold">{actionModal.product.name}</p>
            <form onSubmit={handleAction} className="space-y-3">
              <div>
                <label className="block text-sm font-bold">Cantidad <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={actionData.qty}
                  onChange={(e) => setActionData({ ...actionData, qty: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold">Empleado / Responsable <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  required
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={actionData.user}
                  onChange={(e) => setActionData({ ...actionData, user: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold">Motivo / Proyecto <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Ej. Instalación en Torre B"
                  required
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={actionData.reason}
                  onChange={(e) => setActionData({ ...actionData, reason: e.target.value })}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setActionModal({ show: false, type: "", product: null as any })}
                  className="flex-1 bg-gray-200 p-2 rounded font-bold hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 text-white p-2 rounded font-bold shadow ${actionModal.type === "Entrada" ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"}`}
                >
                  Confirmar
                </button>
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
                <p className="text-3xl font-black text-orange-600">-{totalSalidas
