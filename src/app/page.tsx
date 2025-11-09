"use client";

import Image from 'next/image';
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, Package, X, AlertCircle, Zap, Star } from 'lucide-react';

// ====================================================================
// PASO 1: EXTENSIÓN DE TIPOS (NECESARIO PARA RESOLVER EL ERROR DE window.storage)
// Defininimos la interfaz de la API 'storage' que estás utilizando.
// Reemplaza 'any' por tipos más específicos si conoces la estructura exacta.
interface TrollPrice {
  type?: string;
  name?: string;
  price?: string;
}

interface ServerResponse {
  error?: string;
  nombre?: string;
  expansionf?: string; 
  url?: string;
  troll?: {
    Troll?: TrollPrice[];
    cards?: TrollPrice[]; 
  };
  tcg?: Record<string, string | number>; 
}


// Extendemos la interfaz global Window para incluir nuestra propiedad 'storage'
// Esto resuelve el error de compilación.

// ====================================================================

// Definición de tipos para la carta
interface CardData {
    id: string;
    nombre: string;
    expansion: string;
    image: string;
    trollPrices: string[];
    trollTypes: string[];
    tcgPrices: { type: string; price: string }[];
    timestamp: string;
    salePrice?: number;
}


const PokemonCardScanner = () => {
  const [cards, setCards] = useState<CardData[]>([]);
  const [currentCard, setCurrentCard] = useState<CardData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [manualPrice, setManualPrice] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  // El tipo MediaStream | null fue corregido en tu última versión, lo mantenemos.
  const [stream, setStream] = useState<MediaStream | null>(null); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tipado correcto para elementos de video y canvas
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mantenemos la URL, pero el comentario del error de conexión ya apunta a la IP correcta.
  const SERVER_URL = "http://127.0.0.1:5000/process_image"; // Usa tu IP pública si despliegas

  // ====================================================================
  // EFECTOS DE CICLO DE VIDA
  // ====================================================================

  useEffect(() => {
    // Aseguramos que 'window.storage' exista antes de intentar usarlo
    loadCards();
    
    // Función de limpieza para la cámara (stream)
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]); // Añadimos 'stream' como dependencia para que la función de limpieza funcione correctamente

  // ====================================================================
  // MANEJO DE ESTADO Y ALMACENAMIENTO (SOLUCIÓN AL ERROR DE window.storage)
  // ====================================================================

  const loadCards = async () => {
    // Ya no es necesario 'as any' gracias a la declaración de tipos
    try {
      // ⚙️ CAMBIO: Usamos localStorage para cargar las cartas
      if (typeof window === 'undefined' || !window.localStorage) return;
      const loadedCards: CardData[] = [];
      
      // Itera sobre las claves y filtra por el prefijo 'card:'
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('card:')) {
          const value = localStorage.getItem(key);
          if (value) {
            loadedCards.push(JSON.parse(value) as CardData);
          }
        }
      }
        
      setCards(loadedCards);
    } catch (err) {
      console.log('No hay cartas guardadas aún o error de storage:', err);
    }
  };
  
  const saveCard = async () => {
    if (!currentCard || !manualPrice) {
      setError('Por favor ingresa el precio de venta');
      return;
    }

    try {
      const salePriceValue = parseFloat(manualPrice);
      if (isNaN(salePriceValue) || salePriceValue < 0) {
          setError('Precio de venta inválido');
          return;
      }
      
      const cardToSave: CardData = {
        ...currentCard,
        salePrice: salePriceValue
      };

      localStorage.setItem(`card:${cardToSave.id}`, JSON.stringify(cardToSave));

      setCards(prev => [cardToSave, ...prev]);
      resetScanner();
    } catch (err) {
      setError('Error al guardar la carta');
      console.error('Error al guardar:', err);
    }
  };

  const deleteCard = async (cardId: string) => { // Tipado explícito para cardId
    try {
      localStorage.removeItem(`card:${cardId}`);
      setCards(prev => prev.filter(c => c.id !== cardId));
    } catch (err) {
      console.error('Error al eliminar:', err);
    }
  };
  
  // ====================================================================
  // MANEJO DE CÁMARA E IMAGEN
  // ====================================================================

  const openCamera = async () => {
    // Chequeo de API de navegador (media devices)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Tu navegador no soporta la API de la cámara.');
      return;
    }
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.srcObject = mediaStream;
        await videoElement.play(); // Usar await play() para asegurar que comienza
      }
      
      setStream(mediaStream);
      setIsCameraActive(true);
      setError(null);
    } catch (err) {
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
      console.error('Error al abrir cámara:', err);
    }
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };
  
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Aseguramos que el contexto 2D no sea nulo
    const context = canvas.getContext('2d');
    if (!context) return; 

    // Ajuste de tamaño para asegurar que la imagen capturada coincida con el video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Usamos el callback toBlob correctamente tipado
    canvas.toBlob(async (blob) => {
      if (blob) {
        const imageUrl = URL.createObjectURL(blob);
        setSelectedImage(imageUrl);
        closeCamera();
        await sendImageToServer(blob);
      }
    }, 'image/png');
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => { // Tipado de evento
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const imageUrl = URL.createObjectURL(file);
    setSelectedImage(imageUrl);
    await sendImageToServer(file);
  };

  const sendImageToServer = async (imageBlob: Blob) => { // Tipado de Blob
    setIsProcessing(true);
    setError(null);

    try {
      console.log('📤 Enviando imagen al servidor...');
      console.log(`📸 Tamaño de la imagen: ${imageBlob.size} bytes`);

      const formData = new FormData();
      formData.append('image', imageBlob, 'photo.png');

      const response = await fetch(SERVER_URL, {
        method: 'POST',
        body: formData,
        mode: 'cors'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error del servidor:', errorText);
        throw new Error(`Error del servidor: ${response.status} - ${errorText.substring(0, 50)}...`);
      }

      const jsonResponse = await response.json();
      console.log('✅ Respuesta del servidor recibida:', jsonResponse);
      
      processServerResponse(jsonResponse);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido de red/servidor';
      console.error('❌ Error completo:', err);
      
      if (errorMessage.includes('Failed to fetch')) {
        setError(`No se pudo conectar con el servidor. Verifica que el servidor esté corriendo en ${SERVER_URL}`);
      } else {
        setError(`Error: ${errorMessage}. Verifica la conexión con el servidor.`);
      }
      setSelectedImage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const processServerResponse = (response: ServerResponse) => { // Usamos 'any' ya que la estructura del servidor es desconocida
    try {
      if (response.error) {
        setError(response.error);
        setSelectedImage(null);
        return;
      }

      const nombre = response.nombre || "Nombre no disponible";
      const expansion = response.expansionf || "Expansión no disponible";
      const cardImageUrl = response.url || selectedImage || '';
      
      const trollData = response.troll || {};
      const trollCards = trollData.Troll || trollData.cards || [];
      const trollPrices: string[] = [];
      const trollTypes: string[] = [];
      
      trollCards.forEach((troll: TrollPrice) => {
        trollPrices.push(troll.price || "N/A");
        trollTypes.push(troll.type || troll.name || "N/A");
      });

      const tcgPrices = response.tcg || {};
      const tcgPricesList: { type: string; price: string }[] = [];
      
      if (typeof tcgPrices === 'object' && tcgPrices !== null) {
        // Usamos Object.entries para iterar sobre pares clave-valor de forma segura
        Object.entries(tcgPrices).forEach(([type, price]) => {
          // Aseguramos que 'price' sea un string o number para mostrarlo
          if (price && type !== 'error') {
            tcgPricesList.push({ type, price: String(price) });
          }
        });
      }

      const cardData: CardData = {
        id: Date.now().toString(),
        nombre: nombre,
        expansion: expansion,
        image: cardImageUrl,
        trollPrices: trollPrices,
        trollTypes: trollTypes,
        tcgPrices: tcgPricesList,
        timestamp: new Date().toISOString()
      };

      setCurrentCard(cardData);
      
    } catch (err) {
      setError('Error al procesar la respuesta del servidor');
      console.error('❌ Error procesando respuesta:', err);
      setSelectedImage(null);
    }
  };

  // ====================================================================
  // UTILIDADES Y RENDERIZADO
  // ====================================================================

  const resetScanner = () => {
    setCurrentCard(null);
    setSelectedImage(null);
    setManualPrice('');
    setError(null);
    closeCamera();
  };

  // Cálculo de valor total
  const totalValue = cards.reduce((sum, card) => sum + (card.salePrice || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500 relative overflow-hidden">
      {/* Pokéball decorativos de fondo */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full opacity-10"></div>
      <div className="absolute bottom-20 right-20 w-48 h-48 bg-white rounded-full opacity-10"></div>
      <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-white rounded-full opacity-10"></div>
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6 relative z-10">
        {/* Header Estilo Pokémon */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-3xl shadow-2xl p-6 mb-6 border-4 border-yellow-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white rounded-full p-3 shadow-lg">
                <Zap className="text-yellow-500" size={48} />
              </div>
              <div>
                <h1 className="text-4xl font-black text-white drop-shadow-lg">
                  PokéCard Scanner
                </h1>
                <p className="text-yellow-200 font-semibold mt-1">¡Atrapa el valor de tus cartas!</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-xl border-4 border-yellow-400">
              <div className="text-center">
                <p className="text-sm font-bold text-gray-600 flex items-center gap-1 justify-center">
                  <Star className="text-yellow-500" size={16} />
                  Inventario Total
                </p>
                <p className="text-4xl font-black text-green-600">${totalValue.toFixed(2)}</p>
                <p className="text-sm text-gray-500 font-semibold">{cards.length} cartas</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Scanner Section */}
          <div className="bg-white rounded-3xl shadow-2xl p-6 border-4 border-blue-400">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-4 mb-4">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Camera className="text-yellow-300" size={28} />
                Escanear Carta
              </h2>
            </div>

            {/* Camera View */}
            {isCameraActive && (
              <div className="mb-4 relative">
                <video 
                  ref={videoRef} 
                  className="w-full rounded-2xl shadow-xl border-4 border-yellow-400"
                  autoPlay 
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />
                <button
                  onClick={closeCamera}
                  className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-2xl border-2 border-white"
                >
                  <X size={24} />
                </button>
                <button
                  onClick={capturePhoto}
                  className="mt-4 w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 py-4 px-6 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl border-4 border-yellow-600 transform transition hover:scale-105"
                >
                  <Camera size={24} />
                  ¡CAPTURAR!
                </button>
              </div>
            )}

            {!currentCard && !isCameraActive ? (
              <div className="space-y-4">
                <div className="border-4 border-dashed border-blue-300 rounded-2xl p-8 text-center hover:border-blue-500 transition-all bg-blue-50">
                  {selectedImage && !isProcessing ? (
                    <div className="relative">
                      <Image 
                        src={selectedImage} 
                        alt="Preview" 
                        width={300}
                        height={420}
                        className="max-h-80 mx-auto rounded-xl shadow-2xl border-4 border-yellow-400" 
                        style={{objectFit:'contain', width: 'auto'}}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent rounded-xl"></div>
                    </div>
                  ) : (
                    <div className="py-12">
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 shadow-xl">
                        <Camera className="text-white" size={48} />
                      </div>
                      <p className="text-gray-700 font-bold text-lg">¡Toma una foto de tu carta Pokémon!</p>
                      <p className="text-gray-500 mt-2">O sube una imagen desde tu dispositivo</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={openCamera}
                    disabled={isProcessing}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-4 px-6 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl border-4 border-red-700 transform transition hover:scale-105 disabled:transform-none"
                  >
                    <Camera size={24} />
                    Cámara
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-4 px-6 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl border-4 border-blue-700 transform transition hover:scale-105 disabled:transform-none"
                  >
                    <Upload size={24} />
                    Archivo
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {isProcessing && (
                  <div className="text-center py-8 bg-yellow-50 rounded-2xl border-4 border-yellow-300">
                    <div className="relative w-24 h-24 mx-auto mb-4">
                      <div className="absolute inset-0 border-8 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                      <div className="absolute inset-2 border-8 border-blue-500 border-b-transparent rounded-full animate-spin" style={{animationDirection: 'reverse'}}></div>
                    </div>
                    <p className="text-gray-800 font-black text-lg">¡Analizando tu carta!</p>
                    <p className="text-gray-600 font-semibold mt-2">Conectando con la PokéDex...</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-100 border-4 border-red-500 p-4 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
                    <p className="text-red-800 font-bold">{error}</p>
                  </div>
                )}
              </div>
            ) : currentCard && !isCameraActive ? (
              <div className="space-y-4">
                <div className="relative">
                  <Image
                    src={currentCard.image} 
                    alt="Card" 
                    width={500}
                    height={700}
                    className="w-full rounded-2xl shadow-2xl border-4 border-yellow-400" 
                    style={{ width: '100%', height: 'auto'}}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent rounded-2xl"></div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl p-5 border-4 border-purple-400 shadow-xl">
                  <h3 className="font-black text-2xl text-gray-900 mb-2">{currentCard.nombre}</h3>
                  <p className="text-gray-700 font-bold flex items-center gap-2">
                    <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm">
                      {currentCard.expansion}
                    </span>
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl p-5 border-4 border-green-400 shadow-xl">
                  <h4 className="font-black text-xl text-gray-900 mb-4 flex items-center gap-2">
                    <div className="bg-green-500 rounded-full p-2">
                      <Star className="text-white" size={20} />
                    </div>
                    Precios de Mercado
                  </h4>
                  
                  {/* TCGPlayer Prices */}
                  {currentCard.tcgPrices.length > 0 && (
                    <div className="mb-4 pb-4 border-b-2 border-green-300">
                      <p className="font-black text-sm text-gray-700 mb-3 flex items-center gap-2">
                        <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs">TCGPlayer</span>
                      </p>
                      {currentCard.tcgPrices.map((item, index) => (
                        <div key={index} className="flex justify-between items-center mb-2 bg-white rounded-lg p-2 shadow">
                          <span className="text-sm font-bold text-gray-700">{item.type}:</span>
                          <span className="font-black text-green-700 text-lg">${item.price}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Troll and Toad Prices */}
                  {currentCard.trollPrices.length > 0 && (
                    <div>
                      <p className="font-black text-sm text-gray-700 mb-3 flex items-center gap-2">
                        <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs">Troll & Toad</span>
                      </p>
                      {currentCard.trollPrices.map((price, index) => (
                        <div key={index} className="flex justify-between items-center mb-2 bg-white rounded-lg p-2 shadow">
                          <span className="text-sm font-bold text-gray-700 truncate max-w-[60%]">{currentCard.trollTypes[index]}:</span>
                          <span className="font-black text-green-700 text-lg">{price}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t-2 border-green-300 space-y-2">
                    <a href={`https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(currentCard.nombre)}&view=grid`} 
                        target="_blank" rel="noopener noreferrer" 
                        className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl transition transform hover:scale-105">
                      🔗 Ver en TCGPlayer
                    </a>
                    <a href="https://www.trollandtoad.com/" 
                        target="_blank" rel="noopener noreferrer" 
                        className="block text-center bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-xl transition transform hover:scale-105">
                      🔗 Ver en Troll & Toad
                    </a>
                  </div>
                </div>

                <div className="bg-yellow-50 rounded-2xl p-4 border-4 border-yellow-400">
                  <label className="block text-sm font-black text-gray-800 mb-3">
                    💰 Tu Precio de Venta (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="Ej: 25.00"
                    className="w-full px-4 py-3 border-4 border-yellow-500 rounded-xl focus:border-yellow-600 focus:outline-none font-bold text-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={resetScanner}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-4 px-6 rounded-2xl font-black text-lg border-4 border-gray-400 transition transform hover:scale-105"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveCard}
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-4 px-6 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl border-4 border-green-700 transition transform hover:scale-105"
                  >
                    <Package size={24} />
                    ¡Guardar!
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Inventory Section */}
          <div className="bg-white rounded-3xl shadow-2xl p-6 border-4 border-yellow-400">
            <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-2xl p-4 mb-4">
              <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                <Package className="text-red-600" size={28} />
                Mi Colección ({cards.length})
              </h2>
            </div>

            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2">
              {cards.length === 0 ? (
                <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-4 border-dashed border-gray-300">
                  <div className="bg-gradient-to-br from-gray-300 to-gray-400 w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-4 shadow-xl">
                    <Package className="text-white" size={64} />
                  </div>
                  <p className="text-gray-700 font-black text-xl">¡Tu colección está vacía!</p>
                  <p className="text-gray-500 font-semibold mt-2">Escanea tu primera carta para comenzar</p>
                </div>
              ) : (
                cards.map((card) => (
                  <div key={card.id} className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-4 flex gap-4 hover:shadow-xl transition-all border-4 border-blue-200 hover:border-blue-400 transform hover:scale-[1.02]">
                    <Image 
                      src={card.image} 
                      alt={card.nombre} 
                      width={96}
                      height={128}
                      className="w-24 h-32 object-cover rounded-xl shadow-lg border-2 border-yellow-400" 
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-lg text-gray-900 truncate">{card.nombre}</h3>
                      <p className="text-sm text-gray-600 font-bold truncate mt-1">
                        <span className="bg-purple-200 text-purple-800 px-2 py-1 rounded-full text-xs">
                          {card.expansion}
                        </span>
                      </p>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="bg-gradient-to-r from-green-400 to-green-500 text-white text-lg font-black px-4 py-2 rounded-full shadow-lg border-2 border-green-600">
                          ${card.salePrice?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteCard(card.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-100 p-3 rounded-xl transition-all h-fit border-2 border-transparent hover:border-red-300"
                    >
                      <Trash2 size={24} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PokemonCardScanner;