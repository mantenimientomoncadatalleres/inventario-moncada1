import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
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
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);
const UnlockIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
    />
  </svg>
);
const ChartIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);
const QRIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
    />
  </svg>
);

export default function App() {
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("empleado");
  const [showModal, setShowModal] = useState(false);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [actionModal, setActionModal] = useState({
    show: false,
    type: "",
    product: null,
  });

  const [formData, setFormData] = useState({
    id: "",
    name: "",
    brand: "",
    model: "",
    serial: "",
    location: "",
    stock: 0,
    observations: "",
  });
  const [actionData, setActionData] = useState({
    qty: 1,
    user: "",
    reason: "",
  });

  // CONTRASEÑA DE ADMINISTRADOR
  const PIN_ADMIN = "1234";

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
      // AQUÍ SE ELIMINÓ LA SUGERENCIA
      const pin = prompt("Ingrese el PIN de Administrador:");
      if (pin === PIN_ADMIN) {
        setRole("admin");
      } else if (pin !== null) {
        alert("PIN Incorrecto");
      }
    }
  };

  const handleSaveProduct = async (e) => {
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

  const handleDelete = async (docId) => {
    if (window.confirm("¿Estás seguro de eliminar este producto?")) {
      await deleteDoc(doc(db, "inventario", docId));
    }
  };

  const handleAction = async (e) => {
    e.preventDefault();

    if (actionData.user.trim() === "") {
      alert(
        "⚠️ OBLIGATORIO: Debes escribir el nombre del Empleado o Responsable."
      );
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

  const startScanner = () => {
    const code = prompt(
      "Simulador de Escáner (Ingresa el ID o Serie del producto):"
    );
    if (code) setSearch(code);
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

  const filteredProducts = products.filter(
    (p) =>
      (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.serial || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.id || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-4xl mx-auto bg-white p-4 rounded-xl shadow mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Inventario Moncada
          </h1>
          <p className="text-sm text-gray-500 uppercase tracking-wide">
            Modo:{" "}
            <span
              className={
                role === "admin"
                  ? "text-blue-600 font-bold"
                  : "text-green-600 font-bold"
              }
            >
              {role}
            </span>
          </p>
        </div>
        <button
          onClick={toggleRole}
          className={`p-2 rounded-full text-white ${
            role === "admin" ? "bg-blue-600" : "bg-gray-400"
          }`}
        >
          {role === "admin" ? <UnlockIcon /> : <LockIcon />}
        </button>
      </div>

      <div className="max-w-4xl mx-auto mb-6 flex flex-wrap gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="Buscar producto, serie o ID..."
            className="w-full border p-3 rounded-lg shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={startScanner}
            className="bg-gray-800 text-white p-3 rounded-lg flex items-center gap-2"
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
                id: "",
                name: "",
                brand: "",
                model: "",
                serial: "",
                location: "",
                stock: 0,
                observations: "",
              });
              setShowModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded shadow font-bold"
          >
            + Nuevo Producto
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded shadow flex items-center gap-2 font-bold"
          >
            <ChartIcon /> Reporte del Mes
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProducts.map((p) => (
          <div
            key={p.id}
            className="bg-white p-4 rounded-xl shadow-md border-l-4 border-blue-500"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{p.name}</h3>
                <p className="text-xs text-gray-400 mb-2">{p.id}</p>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <b>Marca:</b> {p.brand}
                  </p>
                  <p>
                    <b>Modelo:</b> {p.model}
                  </p>
                  <p>
                    <b>Serie:</b> {p.serial}
                  </p>
                  <p>
                    <b>Ubicación:</b> {p.location}
                  </p>
                  <p className="text-lg mt-2">
                    <b>Stock:</b>{" "}
                    <span
                      className={
                        p.stock < 5
                          ? "text-red-500 font-bold"
                          : "text-green-600 font-bold"
                      }
                    >
                      {p.stock} piezas
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <button
                onClick={() =>
                  setActionModal({ show: true, type: "Entrada", product: p })
                }
                className="flex-1 bg-green-100 text-green-700 py-2 rounded font-bold hover:bg-green-200"
              >
                + Entrada
              </button>
              <button
                onClick={() =>
                  setActionModal({ show: true, type: "Salida", product: p })
                }
                className="flex-1 bg-orange-100 text-orange-700 py-2 rounded font-bold hover:bg-orange-200"
              >
                - Salida
              </button>
            </div>

            {role === "admin" && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    setFormData(p);
                    setShowModal(true);
                  }}
                  className="flex-1 text-blue-600 border border-blue-200 py-1 rounded text-sm hover:bg-blue-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(p.docId)}
                  className="flex-1 text-red-600 border border-red-200 py-1 rounded text-sm hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {actionModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h2
              className={`text-xl font-bold mb-4 ${
                actionModal.type === "Entrada"
                  ? "text-green-600"
                  : "text-orange-600"
              }`}
            >
              Registrar {actionModal.type}
            </h2>
            <p className="mb-4 text-gray-600 font-bold">
              {actionModal.product.name}
            </p>
            <form onSubmit={handleAction} className="space-y-3">
              <div>
                <label className="block text-sm font-bold">
                  Cantidad <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full border p-2 rounded"
                  value={actionData.qty}
                  onChange={(e) =>
                    setActionData({ ...actionData, qty: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-bold">
                  Empleado / Responsable <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  required
                  className="w-full border p-2 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={actionData.user}
                  onChange={(e) =>
                    setActionData({ ...actionData, user: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-bold">
                  Motivo / Proyecto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. Instalación en Torre B"
                  required
                  className="w-full border p-2 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={actionData.reason}
                  onChange={(e) =>
                    setActionData({ ...actionData, reason: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setActionModal({ show: false })}
                  className="flex-1 bg-gray-200 p-2 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 text-white p-2 rounded ${
                    actionModal.type === "Entrada"
                      ? "bg-green-600"
                      : "bg-orange-600"
                  }`}
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
              <h2 className="text-xl font-bold text-purple-700">
                Resumen del Mes
              </h2>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-500 font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-100 p-4 rounded-lg text-center border border-green-200">
                <p className="text-sm text-green-700 font-bold uppercase">
                  Total Entradas
                </p>
                <p className="text-3xl font-black text-green-600">
                  +{totalEntradas}
                </p>
                <p className="text-xs text-gray-500 mt-1">piezas ingresadas</p>
              </div>
              <div className="bg-orange-100 p-4 rounded-lg text-center border border-orange-200">
                <p className="text-sm text-orange-700 font-bold uppercase">
                  Total Salidas
                </p>
                <p className="text-3xl font-black text-orange-600">
                  -{totalSalidas}
                </p>
                <p className="text-xs text-gray-500 mt-1">piezas despachadas</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Se registraron {monthlyMovements.length} movimientos en total
              durante este mes.
            </p>

            <button
              onClick={exportMonthlyReport}
              className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg shadow hover:bg-purple-700"
            >
              Descargar Excel (CSV)
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {formData.docId ? "Editar Producto" : "Nuevo Producto"}
            </h2>
            <form onSubmit={handleSaveProduct} className="space-y-3">
              <input
                type="text"
                placeholder="Nombre (Ej. Espuma limpiadora)"
                required
                className="w-full border p-2 rounded"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Marca"
                  className="border p-2 rounded"
                  value={formData.brand}
                  onChange={(e) =>
                    setFormData({ ...formData, brand: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Modelo"
                  className="border p-2 rounded"
                  value={formData.model}
                  onChange={(e) =>
                    setFormData({ ...formData, model: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="No. Serie"
                  className="border p-2 rounded"
                  value={formData.serial}
                  onChange={(e) =>
                    setFormData({ ...formData, serial: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="Stock Inicial"
                  required
                  className="border p-2 rounded"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: e.target.value })
                  }
                />
              </div>
              <input
                type="text"
                placeholder="Ubicación (Ej. Estante A2)"
                className="w-full border p-2 rounded"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
              />
              <textarea
                placeholder="Observaciones"
                className="w-full border p-2 rounded"
                value={formData.observations}
                onChange={(e) =>
                  setFormData({ ...formData, observations: e.target.value })
                }
              />
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 p-2 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white p-2 rounded"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
