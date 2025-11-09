import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, Package, X, AlertCircle, Zap, Star } from 'lucide-react';

const PokemonCardScanner = () => {
  const [cards, setCards] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [manualPrice, setManualPrice] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState(null);
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Cambia esta URL según donde esté corriendo tu servidor
  // Si estás en la misma máquina: "http://127.0.0.1:5000/process_image"
  // Si estás en red local: "http://172.31.87.111:5000/process_image"
  // Si tienes IP pública: "http://TU_IP_PUBLICA:5000/process_image"
  const SERVER_URL = "http://127.0.0.1:5000/process_image";

  useEffect(() => {
    loadCards();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const loadCards = async () => {
    try {
      const result = await window.storage.list('card:');
      if (result && result.keys) {
        const cardPromises = result.keys.map(async (key) => {
          const data = await window.storage.get(key);
          return data ? JSON.parse(data.value) : null;
        });
        const loadedCards = (await Promise.all(cardPromises)).filter(Boolean);
        setCards(loadedCards);
      }
    } catch (err) {
      console.log('No hay cartas guardadas aún');
    }
  };

  const openCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
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
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (blob) {
        const imageUrl = URL.createObjectURL(blob);
        setSelectedImage(imageUrl);
        closeCamera();
        await sendImageToServer(blob);
      }
    }, 'image/png');
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const imageUrl = URL.createObjectURL(file);
    setSelectedImage(imageUrl);
    await sendImageToServer(file);
  };

  const sendImageToServer = async (imageBlob) => {
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
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const jsonResponse = await response.json();
      console.log('✅ Respuesta del servidor recibida:', jsonResponse);
      
      processServerResponse(jsonResponse);
    } catch (err) {
      console.error('❌ Error completo:', err);
      
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        setError('No se pudo conectar con el servidor. Verifica que el servidor esté corriendo en http://52.203.146.149:5000');
      } else {
        setError(`Error: ${err.message}. Verifica la conexión con el servidor.`);
      }
      setSelectedImage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const processServerResponse = (response) => {
    try {
      if (response.error) {
        setError(response.error);
        setSelectedImage(null);
        return;
      }

      const nombre = response.nombre || "Nombre no disponible";
      const expansion = response.expansionf || "Expansión no disponible";
      const cardImageUrl = response.url || selectedImage;
      
      // Procesar precios de Troll and Toad
      const trollData = response.troll || {};
      const trollCards = trollData.Troll || trollData.cards || [];
      const trollPrices = [];
      const trollTypes = [];
      
      trollCards.forEach(troll => {
        trollPrices.push(troll.price || "N/A");
        trollTypes.push(troll.type || troll.name || "N/A");
      });

      // Procesar precios de TCGPlayer
      const tcgPrices = response.tcg || {};
      const tcgPricesList = [];
      
      if (typeof tcgPrices === 'object') {
        Object.entries(tcgPrices).forEach(([type, price]) => {
          if (price && type !== 'error') {
            tcgPricesList.push({ type, price });
          }
        });
      }

      const cardData = {
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

  const saveCard = async () => {
    if (!currentCard || !manualPrice) {
      setError('Por favor ingresa el precio de venta');
      return;
    }

    try {
      const cardToSave = {
        ...currentCard,
        salePrice: parseFloat(manualPrice)
      };

      await window.storage.set(`card:${cardToSave.id}`, JSON.stringify(cardToSave));
      
      setCards(prev => [cardToSave, ...prev]);
      resetScanner();
    } catch (err) {
      setError('Error al guardar la carta');
    }
  };

  const deleteCard = async (cardId) => {
    try {
      await window.storage.delete(`card:${cardId}`);
      setCards(prev => prev.filter(c => c.id !== cardId));
    } catch (err) {
      console.error('Error al eliminar:', err);
    }
  };

  const resetScanner = () => {
    setCurrentCard(null);
    setSelectedImage(null);
    setManualPrice('');
    setError(null);
    closeCamera();
  };

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
                      <img 
                        src={selectedImage} 
                        alt="Preview" 
                        className="max-h-80 mx-auto rounded-xl shadow-2xl border-4 border-yellow-400" 
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
                  <img 
                    src={currentCard.image} 
                    alt="Card" 
                    className="w-full rounded-2xl shadow-2xl border-4 border-yellow-400" 
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
                    <img 
                      src={card.image} 
                      alt={card.nombre} 
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
