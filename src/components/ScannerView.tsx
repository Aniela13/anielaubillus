// src/components/ScannerView.tsx
import React from 'react';
import { Camera, Upload, X, AlertCircle, Zap, Star, Package, Trash2 } from 'lucide-react';
import { CardData} from './PokemonCardScanner'; // Importar tipos

// Tipos de Props
interface ScannerViewProps {
    currentCard: CardData | null ;
    isProcessing: boolean;
    error: string | null;
    selectedImage: string | null;
    manualPrice: string;
    setManualPrice: React.Dispatch<React.SetStateAction<string>>;
    isCameraActive: boolean;
    setIsCameraActive: React.Dispatch<React.SetStateAction<boolean>>;
    stream: MediaStream | null;
    setStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    resetScanner: () => void;
    saveCard: () => void;
    sendImageToServer: (imageBlob: Blob, processingText?: string) => Promise<void>;
    setSelectedImage: React.Dispatch<React.SetStateAction<string | null>>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    closeCamera: () => void;
    cards: CardData[];
    totalValue: number;
}

const ScannerView: React.FC<ScannerViewProps> = ({
    currentCard,
    isProcessing,
    error,
    selectedImage,
    manualPrice,
    setManualPrice,
    isCameraActive,
    setIsCameraActive,
    stream,
    setStream,
    fileInputRef,
    videoRef,
    canvasRef,
    resetScanner,
    saveCard,
    sendImageToServer,
    setSelectedImage,
    setError,
    closeCamera,
    cards,
    totalValue,
}) => {
    
    const openCamera = async () => {
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
                await videoElement.play();
            }
            
            setStream(mediaStream);
            setIsCameraActive(true);
            setError(null);
        } catch (err) {
            setError('No se pudo acceder a la cámara. Verifica los permisos.');
            console.error('Error al abrir cámara:', err);
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return; 

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

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        const imageUrl = URL.createObjectURL(file);
        setSelectedImage(imageUrl);
        await sendImageToServer(file);
    };
    
    return (
        <div className="grid lg:grid-cols-2 gap-6">
            {/* 1. Scanner/Result Section */}
            <div className="holographic-card rounded-3xl shadow-2xl p-6 border-8 border-yellow-400 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/20 opacity-30"></div>
                <div className="absolute inset-0 bg-gradient-to-tl from-yellow-300/10 via-transparent to-purple-300/10"></div>
                
                <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-600 rounded-2xl p-4 mb-4 relative z-10 border-4 border-blue-800 shadow-xl">
                    <h2 className="text-3xl font-black text-white flex items-center gap-3" style={{ textShadow: '3px 3px 0 #000' }}>
                        <Camera className="text-yellow-300 animate-pulse" size={32} />
                        ESCANEAR CARTA
                    </h2>
                </div>

                <div className="relative z-10">
                    {/* A. Vista de Cámara Activa */}
                    {isCameraActive && (
                        <div className="mb-4 relative">
                            <video ref={videoRef} className="w-full rounded-2xl shadow-xl border-4 border-yellow-400" autoPlay playsInline />
                            <canvas ref={canvasRef} className="hidden" />
                            <button onClick={closeCamera} className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-2xl border-2 border-white">
                                <X size={24} />
                            </button>
                            <button onClick={capturePhoto} className="mt-4 w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 py-4 px-6 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl border-4 border-yellow-600 transform transition hover:scale-105">
                                <Camera size={24} /> ¡CAPTURAR!
                            </button>
                        </div>
                    )}
                    
                    {/* B. Vista de Selección (Inicial) */}
                    {!currentCard && !isCameraActive && (
                        <div className="space-y-4">
                            <div className="border-4 border-dashed border-blue-300 rounded-2xl p-8 text-center hover:border-blue-500 transition-all bg-white/10 backdrop-blur-sm">
                                
                                {selectedImage && !isProcessing ? (
                                    <div className="relative">
                                        <img 
                                    src={selectedImage} 
                                    alt={"Imagen seleccionada para escanear"} 
                                    // CLASES DE ESTILO CRÍTICAS: Aseguran que la imagen se ajuste y limite su altura
                                    className="w-full rounded-2xl shadow-2xl border-4 border-yellow-400 h-auto object-contain bg-gray-900" 
                                    style={{ maxHeight: '450px' }} // Límite de altura para evitar ventana larga
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent rounded-2xl"></div>
                            </div>
                                ) : (
                                    <div className="py-12">
                                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 shadow-xl">
                                            <Camera className="text-white" size={48} />
                                        </div>
                                        {isProcessing ? (
                                            <div className="text-center">
                                                <div className="relative w-24 h-24 mx-auto mb-4">
                                                    <div className="absolute inset-0 border-8 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <div className="absolute inset-2 border-8 border-blue-500 border-b-transparent rounded-full animate-spin" style={{animationDirection: 'reverse'}}></div>
                                                </div>
                                                <p className="text-white font-black text-lg drop-shadow-lg">Analizando tu carta</p>
                                                <p className="text-yellow-300 font-semibold mt-2">Conectando con la PokéDex...</p>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-white font-bold text-lg drop-shadow-lg">¡Toma una foto de tu carta Pokémon!</p>
                                                <p className="text-gray-300 mt-2">O sube una imagen desde tu dispositivo</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={openCamera} disabled={isProcessing} className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 text-white py-4 px-6 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl border-4 border-red-700 transform transition hover:scale-105 disabled:transform-none">
                                    <Camera size={24} /> Cámara
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white py-4 px-6 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl border-4 border-blue-700 transform transition hover:scale-105 disabled:transform-none">
                                    <Upload size={24} /> Archivo
                                </button>
                            </div>

                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

                            {error && (
                                <div className="bg-red-100 border-4 border-red-500 p-4 rounded-2xl flex items-start gap-3">
                                    <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
                                    <p className="text-red-800 font-bold">{error}</p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* C. Vista de Resultado (currentCard) */}
                    {currentCard && !isCameraActive && (
                        <div className="space-y-4">
                            <div className="relative">
                                <img src={currentCard.image} alt="Card" className="w-full rounded-2xl shadow-2xl border-4 border-yellow-400" style={{ width: '100%', height: 'auto'}} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent rounded-2xl"></div>
                            </div>
                            
                            {/* Card Info */}
                            <div className="bg-gradient-to-br from-purple-100/80 to-pink-100/80 backdrop-blur-sm rounded-2xl p-5 border-4 border-purple-400 shadow-xl">
                                <h3 className="font-black text-2xl text-gray-900 mb-2">{currentCard.nombre}</h3>
                                <p className="text-gray-700 font-bold flex items-center gap-2">
                                    <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm">{currentCard.expansion}</span>
                                </p>
                            </div>

                            {/* Prices */}
                            <div className="bg-gradient-to-br from-green-100/80 to-emerald-100/80 backdrop-blur-sm rounded-2xl p-5 border-4 border-green-400 shadow-xl">
                                <h4 className="font-black text-xl text-gray-900 mb-4 flex items-center gap-2">
                                    <div className="bg-green-500 rounded-full p-2"><Star className="text-white" size={20} /></div>
                                    Precios de Mercado
                                </h4>
                                
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
                                
                                <div className="mt-4 pt-4 border-t-2 border-green-300 space-y-2">
                                    <a href={`https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(currentCard.nombre)}&view=grid`} target="_blank" rel="noopener noreferrer" className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl transition transform hover:scale-105">
                                        🔗 Ver en TCGPlayer
                                    </a>
                                    
                                </div>
                            </div>

                            {/* Manual Price Input */}
                            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border-4 border-yellow-400">
                                <label className="block text-sm font-black text-white mb-3 drop-shadow-lg">Tu Precio de Venta (USD)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={manualPrice}
                                    onChange={(e) => setManualPrice(e.target.value)}
                                    placeholder="Ej: 25.00"
                                    className="w-full px-4 py-3 border-4 border-yellow-500 rounded-xl focus:border-yellow-600 focus:outline-none font-bold text-lg"
                                />
                                {error && <p className="text-red-300 font-bold mt-2">{error}</p>}
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={resetScanner} className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-4 px-6 rounded-2xl font-black text-lg border-4 border-gray-400 transition transform hover:scale-105">
                                    Cancelar
                                </button>
                                <button onClick={saveCard} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-4 px-6 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl border-4 border-green-700 transition transform hover:scale-105">
                                    <Package size={24} /> Guardar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Inventory Quick View Section (Mantiene la Colección lateral) */}
            <div className="holographic-card rounded-3xl shadow-2xl p-6 border-8 border-yellow-400 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/20 opacity-30"></div>
                <div className="absolute inset-0 bg-gradient-to-tl from-yellow-300/10 via-transparent to-purple-300/10"></div>
                
                <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500 rounded-2xl p-4 mb-4 relative z-10 border-4 border-yellow-600 shadow-xl">
                    <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3" style={{ textShadow: '2px 2px 0 rgba(255,255,255,0.5)' }}>
                        <Package className="text-red-600 animate-pulse" size={32} /> MI COLECCIÓN RÁPIDA ({cards.length})
                    </h2>
                </div>

                <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2 relative z-10">
                    {cards.length === 0 ? (
                        // MEJORA: Centralizar el Call to Action para escanear
                        <div className="text-center py-16 bg-white/10 backdrop-blur-sm rounded-2xl border-4 border-dashed border-gray-300">
                            <div className="bg-gradient-to-br from-gray-400 to-gray-500 w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-4 shadow-xl">
                                <Package className="text-white" size={64} />
                            </div>
                            <p className="text-white font-black text-xl drop-shadow-lg">¡Tu colección está vacía!</p>
                            <p className="text-yellow-300 font-semibold mt-2">Usa el **Escáner de Cartas** para comenzar a registrar tu inventario.</p>
                            <p className="text-white font-black mt-4">Valor Total: ${totalValue.toFixed(2)}</p>
                        </div>
                    ) : (
                        cards.slice(0, 10).map((card) => ( // Mostrar solo las últimas 10 para vista rápida
                            <div key={card.id} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex gap-4 hover:shadow-xl transition-all border-4 border-blue-200 hover:border-blue-400 transform hover:scale-[1.02]">
                                <img src={card.image} alt={card.nombre} className="w-24 h-32 object-cover rounded-xl shadow-lg border-2 border-yellow-400" />
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-lg text-white truncate drop-shadow-lg">{card.nombre}</h3>
                                    <p className="text-sm text-gray-200 font-bold truncate mt-1">
                                        <span className="bg-purple-500 text-white px-2 py-1 rounded-full text-xs">{card.expansion}</span>
                                    </p>
                                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                                        <span className="bg-gradient-to-r from-green-400 to-green-500 text-white text-lg font-black px-4 py-2 rounded-full shadow-lg border-2 border-green-600">${card.salePrice?.toFixed(2)}</span>
                                    </div>
                                </div>
                                <button className="text-red-500 hover:text-red-700 hover:bg-red-100 p-3 rounded-xl transition-all h-fit border-2 border-transparent hover:border-red-300">
                                    <Trash2 size={24} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScannerView;