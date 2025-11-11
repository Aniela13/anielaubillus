// src/app/PokemonCardScanner.tsx
"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Camera, Zap, Star, Settings, User, LogIn, FolderOpen, Heart} from 'lucide-react';

// Importación de Componentes Vistas y Modales
import { ContactModal, DonateModal, RankingHelpModal } from './Modals';
import ProfileView from './ProfileView';
import CollectionView from './CollectionView';
import SettingsView from './SettingsView';
import ScannerView from './ScannerView';

// Tipos (Tipos Centralizados)

export interface ServerResponse {
  error?: string;
  nombre?: string;
  expansionf?: string; 
  url?: string;
  tcg?: Record<string, string | number>; 
}

export interface CardData {
  id: string;
  nombre: string;
  expansion: string;
  image: string;
  tcgPrices: { type: string; price: string }[];
  timestamp: string;
  salePrice?: number;
}

export interface PriceDetails {
    market?: number;
    low?: number;
    // Otros campos que pueda tener el objeto de precio si son necesarios
}

export interface TCGPlayerPrices {
    holofoil?: PriceDetails;
    normal?: PriceDetails;
    reverseHolofoil?: PriceDetails;
    // Agregamos [key: string]: PriceDetails | undefined para manejar cualquier otro tipo de precio
    [key: string]: PriceDetails | undefined; 
}

// TIPOS EXTENDIDOS PARA MANEJAR LA RESPUESTA ANIDADA DEL SERVIDOR
interface CardInfo {
    name?: string;
    images?: { large?: string; small?: string; };
    set?: { name?: string; };
    // Nuevo tipo TCGPlayerPrices para evitar 'any'
    tcgplayer?: { 
        prices?: {
            holofoil?: { market?: number | string };
            normal?: { market?: number | string };
            // Agregamos un index signature si hay otras propiedades a nivel superior
            [key: string]: { market?: number | string } | undefined; 
        } 
    }; 
    cardmarket?: { prices?: { lowPrice?: number; averageSellPrice?: number; } };
    expansionf?: string;
}
interface FullServerResponse extends ServerResponse {
    card_info?: CardInfo;
}

// URL de la API (MEJORA: Usar variable de entorno real en un proyecto Next.js)
const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "http://172.31.87.111:5000/process_image";

// Sistema de Rankings (Mantener la lógica aquí para ser pasada como prop)
const getRankInfo = (cardCount: number) => {
    if (cardCount >= 500) return { name: 'Maestro Pokémon', color: 'from-purple-500 to-pink-500', icon: '👑' };
    if (cardCount >= 250) return { name: 'Campeón de Liga', color: 'from-yellow-400 to-orange-500', icon: '🏆' };
    if (cardCount >= 100) return { name: 'Líder de Gimnasio', color: 'from-blue-400 to-cyan-500', icon: '⚡' };
    if (cardCount >= 50) return { name: 'Entrenador Experto', color: 'from-green-400 to-emerald-500', icon: '🎯' };
    if (cardCount >= 20) return { name: 'Entrenador Avanzado', color: 'from-indigo-400 to-blue-500', icon: '🔥' };
    if (cardCount >= 10) return { name: 'Entrenador Intermedio', color: 'from-teal-400 to-green-500', icon: '✨' };
    if (cardCount >= 5) return { name: 'Entrenador Junior', color: 'from-lime-400 to-green-400', icon: '🌟' };
    return { name: 'Novato', color: 'from-gray-400 to-gray-500', icon: '🎒' };
};


const PokemonCardScanner = () => {
    const [cards, setCards] = useState<CardData[]>([]);
    const [currentCard, setCurrentCard] = useState<CardData | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [manualPrice, setManualPrice] = useState('');
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null); 
    const [showContactModal, setShowContactModal] = useState(false);
    const [showDonateModal, setShowDonateModal] = useState(false);
    const [showRankingHelp, setShowRankingHelp] = useState(false);
    const [currentView, setCurrentView] = useState<'scanner' | 'profile' | 'collection' | 'settings'>('scanner'); 
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // MEJORA: Mover loadCards fuera del useEffect para evitar llamadas asíncronas innecesarias
    const loadCards = useCallback(() => {
        try {
            if (typeof window === 'undefined' || !window.localStorage) return;
            const loadedCards: CardData[] = [];
            
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
    }, []);

    // Cleanup de la cámara
    useEffect(() => {
        loadCards();
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream, loadCards]);

    // Lógica principal de Guardar y Eliminar (Centralizada)
    const saveCard = () => {
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
            
            const cardToSave: CardData = { ...currentCard, salePrice: salePriceValue };
            localStorage.setItem(`card:${cardToSave.id}`, JSON.stringify(cardToSave));
            setCards(prev => [cardToSave, ...prev]);
            resetScanner();
        } catch (err) {
            setError('Error al guardar la carta');
            console.error('Error al guardar:', err);
        }
    };

    const deleteCard = (cardId: string) => {
        try {
            localStorage.removeItem(`card:${cardId}`);
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

    const closeCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsCameraActive(false);
    };

    // Funciones del escáner (lógicas que interactúan con el servidor, movidas al componente principal)
    const processServerResponse = (response: FullServerResponse) => {
        try {
            if (response.error) {
                setError(response.error);
                setSelectedImage(null);
                return;
            }
        // 1. Extraer la información principal anidada (response.card_info)
        // Usamos indexación segura, asumiendo que el JSON completo es la 'response' si no está anidado.
        const cardInfo = response.card_info || response as CardInfo; 

        // 2. Extraer Nombre, Expansión e Imagen de cardInfo
        const nombre = cardInfo.name || "Nombre no disponible";
        // La expansión está anidada en set.name
        const expansion = cardInfo.set?.name || cardInfo.expansionf || "Expansión no disponible";
        // Usamos la URL 'large' o 'small' si está disponible
        const cardImageUrl = cardInfo.images?.large || cardInfo.images?.small || selectedImage || ''; 
        
        // --- PRECIOS ---

        // 4. Lógica para TCGPlayer (Extrayendo Holofoil y Market Price)
        const tcgPricesAPI = cardInfo.tcgplayer?.prices || {};
        const tcgPricesList: { type: string; price: string }[] = [];

        if (tcgPricesAPI.holofoil?.market) {
            const priceValue = tcgPricesAPI.holofoil.market;
    
            // Si sabes que es un número, puedes forzar el casteo para evitar el linter, pero la conversión a String es más segura con parseFloat.
            const priceString = String(priceValue);

            tcgPricesList.push({ 
                type: "Holo Market Price", 
                price: parseFloat(priceString).toFixed(2) // o: String(priceValue).toFixed(2) si el linter lo permite
            });
        }
        if (tcgPricesAPI.normal?.market) {
            const priceValue = tcgPricesAPI.normal.market;
            const priceString = String(priceValue); 
             tcgPricesList.push({ 
                 type: "Normal Market Price", 
                 price: parseFloat(priceString).toFixed(2)
             });
        }
        if (tcgPricesAPI.lowPrice) {
            const priceValue = tcgPricesAPI.lowPrice;
            const priceString = String(priceValue);
             tcgPricesList.push({ 
                 type: "Low Price (CardMarket)", 
                 price: parseFloat(priceString).toFixed(2) 
             });
        }
        
        // 5. Crear el objeto CardData
        const cardData: CardData = {
            id: Date.now().toString(),
            nombre: nombre,
            expansion: expansion,
            image: cardImageUrl,
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
    
    const sendImageToServer = async (imageBlob: Blob) => {
        setIsProcessing(true);
        setError(null);

        try {
            // MEJORA: Añadir feedback de progreso
            // (La implementación del feedback de progreso es compleja y se maneja con estados locales en ScannerView)

            const formData = new FormData();
            formData.append('image', imageBlob, 'photo.png');

            const response = await fetch(SERVER_URL, {
                method: 'POST',
                body: formData,
                mode: 'cors'
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error del servidor: ${response.status} - ${errorText.substring(0, 50)}...`);
            }

            const jsonResponse = await response.json();
            processServerResponse(jsonResponse);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido de red/servidor';
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

    // Propiedades calculadas
    const totalValue = useMemo(() => cards.reduce((sum, card) => sum + (card.salePrice || 0), 0), [cards]);
    const currentRank = useMemo(() => getRankInfo(cards.length), [cards.length]);


    // Renderizado de las vistas
    const renderView = () => {
        switch (currentView) {
            case 'profile':
                return <ProfileView cards={cards} totalValue={totalValue} currentRank={currentRank} setShowRankingHelp={setShowRankingHelp} />;
            case 'collection':
                return <CollectionView cards={cards} deleteCard={deleteCard} />;
            case 'settings':
                return <SettingsView />;
            case 'scanner':
            default:
                // Se pasa toda la lógica necesaria al ScannerView para evitar el "god component"
                return <ScannerView 
                    currentCard={currentCard}
                    isProcessing={isProcessing}
                    error={error}
                    selectedImage={selectedImage}
                    manualPrice={manualPrice}
                    setManualPrice={setManualPrice}
                    isCameraActive={isCameraActive}
                    setIsCameraActive={setIsCameraActive}
                    stream={stream}
                    setStream={setStream}
                    fileInputRef={fileInputRef}
                    videoRef={videoRef}
                    canvasRef={canvasRef}
                    resetScanner={resetScanner}
                    saveCard={saveCard}
                    sendImageToServer={sendImageToServer}
                    setSelectedImage={setSelectedImage}
                    setError={setError}
                    closeCamera={closeCamera}
                    cards={cards} // Para el Call to Action
                    totalValue={totalValue} // Para el Call to Action
                />;
        }
    };

    return (
        <div className="min-h-screen relative overflow-hidden" style={{
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 25%, #FFD700 50%, #FFA500 75%, #FFD700 100%)',
            backgroundSize: '400% 400%',
            animation: 'shimmer 3s ease infinite'
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bungee&display=swap');
                
                @keyframes shimmer {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                @keyframes holographic {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .holographic-card {
                    background: linear-gradient(125deg, 
                        #1a1a2e 0%, #16213e 10%, #0f3460 20%, #00d4ff 25%, #0f3460 30%, #16213e 40%,
                        #1a1a2e 50%, #16213e 60%, #0f3460 70%, #ff00ff 75%, #0f3460 80%, #16213e 90%, #1a1a2e 100%
                    );
                    background-size: 400% 400%;
                    animation: holographic 6s ease infinite;
                }
                .pokemon-font {
                    font-family: 'Bungee', cursive;
                }
            `}</style>
            
            {/* Fondo y decoraciones */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `repeating-linear-gradient( 45deg, transparent, transparent 10px, rgba(255,255,255,0.3) 10px, rgba(255,255,255,0.3) 20px)` }}></div>
            <div className="absolute top-10 left-10 w-32 h-32 opacity-15"> {/* Pokéball Deco 1 */}
                <div className="w-full h-full rounded-full bg-gradient-to-br from-red-600 to-red-400 relative border-4 border-black">
                    <div className="absolute top-1/2 left-0 right-0 h-2 bg-black transform -translate-y-1/2"></div>
                    <div className="absolute top-1/2 left-1/2 w-10 h-10 bg-white rounded-full border-4 border-black transform -translate-x-1/2 -translate-y-1/2">
                        <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-black rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
                    </div>
                </div>
            </div>
            <div className="absolute bottom-20 right-20 w-40 h-40 opacity-15"> {/* Pokéball Deco 2 */}
                <div className="w-full h-full rounded-full bg-gradient-to-br from-red-600 to-red-400 relative border-4 border-black">
                    <div className="absolute top-1/2 left-0 right-0 h-2 bg-black transform -translate-y-1/2"></div>
                    <div className="absolute top-1/2 left-1/2 w-12 h-12 bg-white rounded-full border-4 border-black transform -translate-x-1/2 -translate-y-1/2">
                        <div className="absolute top-1/2 left-1/2 w-5 h-5 bg-black rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
                    </div>
                </div>
            </div>
            <div className="absolute top-1/4 left-1/3 text-white text-4xl opacity-20">⭐</div>
            <div className="absolute top-2/3 left-1/4 text-white text-3xl opacity-20">✨</div>
            <div className="absolute top-1/2 right-1/3 text-white text-5xl opacity-20">⭐</div>
            
            <div className="max-w-7xl mx-auto p-4 sm:p-6 relative z-10">
                {/* Header/Menu Superior Translúcido */}
                <div className="bg-black/40 backdrop-blur-md rounded-2xl shadow-2xl p-4 mb-6 border-2 border-yellow-400/50">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-6">
                            <button onClick={() => setCurrentView('scanner')} className={`flex items-center gap-2 font-bold transition-all ${currentView === 'scanner' ? 'text-yellow-300' : 'text-white hover:text-yellow-300'}`}>
                                <Camera size={20} /> Escáner
                            </button>
                            <button onClick={() => setCurrentView('profile')} className={`flex items-center gap-2 font-bold transition-all ${currentView === 'profile' ? 'text-yellow-300' : 'text-white hover:text-yellow-300'}`}>
                                <User size={20} /> Mi Perfil
                            </button>
                            <button onClick={() => setCurrentView('collection')} className={`flex items-center gap-2 font-bold transition-all ${currentView === 'collection' ? 'text-yellow-300' : 'text-white hover:text-yellow-300'}`}>
                                <FolderOpen size={20} /> Mis Cartas
                            </button>
                            <button onClick={() => setCurrentView('settings')} className={`flex items-center gap-2 font-bold transition-all ${currentView === 'settings' ? 'text-yellow-300' : 'text-white hover:text-yellow-300'}`}>
                                <Settings size={20} /> Configuración
                            </button>
                            <button
                                onClick={() => setShowDonateModal(true)}
                                className="flex items-center gap-2 font-bold text-red-500 hover:text-red-300 transition-all "
                            >
                                <Heart size={20} /> Donar
                                </button>
                        </div>
                        <button className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl transition-all border-2 border-yellow-400">
                            <LogIn size={20} /> Iniciar Sesión
                        </button>
                    </div>
                </div>

                {/* Header Principal - Título y Valor Total (Se mantiene aquí por ser información global) */}
                <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 rounded-3xl shadow-2xl p-6 mb-6 border-8 border-yellow-400 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10 animate-pulse"></div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            {/* Logo/Pokeball */}
                            <div className="relative">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-red-400 relative border-4 border-black shadow-2xl">
                                    <div className="absolute top-1/2 left-0 right-0 h-2 bg-black transform -translate-y-1/2"></div>
                                    <div className="absolute top-1/2 left-1/2 w-8 h-8 bg-gradient-to-br from-white to-gray-200 rounded-full border-4 border-black transform -translate-x-1/2 -translate-y-1/2 shadow-inner">
                                        <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-gradient-to-br from-gray-700 to-black rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
                                    </div>
                                    <div className="absolute top-2 left-2 w-4 h-4 bg-white rounded-full opacity-60"></div>
                                </div>
                                <Zap className="absolute -top-1 -right-1 text-yellow-400 animate-pulse" size={24} />
                            </div>
                            <div>
                                <h1 className="pokemon-font text-5xl text-white drop-shadow-lg" style={{ textShadow: '4px 4px 0 #000, -1px -1px 0 #FFD700, 1px -1px 0 #FFD700, -1px 1px 0 #FFD700, 1px 1px 0 #FFD700' }}>
                                    PokéCard Scanner
                                </h1>
                                <p className="text-yellow-300 font-bold mt-1 text-lg flex items-center gap-2">
                                    <Zap className="text-yellow-400 animate-pulse" size={20} /> Atrapa el valor de tus cartas <Zap className="text-yellow-400 animate-pulse" size={20} />
                                </p>
                            </div>
                        </div>
                        {/* Indicador de Valor Total */}
                        <div className="bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-500 rounded-2xl p-5 shadow-2xl border-4 border-yellow-600 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                            <div className="text-center relative z-10">
                                <p className="text-sm font-black text-gray-800 flex items-center gap-1 justify-center mb-1">
                                    <Star className="text-red-600 animate-pulse" size={20} /> INVENTARIO TOTAL <Star className="text-red-600 animate-pulse" size={20} />
                                </p>
                                <p className="text-5xl font-black text-green-600 drop-shadow-lg" style={{ textShadow: '2px 2px 0 #000' }}>${totalValue.toFixed(2)}</p>
                                <p className="text-sm text-gray-800 font-bold mt-1 bg-white/50 rounded-full px-3 py-1 inline-block">
                                    {cards.length} cartas
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contenido principal según la vista */}
                {renderView()}
                
                {/* Modals renderizados fuera del flujo principal */}
                <ContactModal showContactModal={showContactModal} setShowContactModal={setShowContactModal} />
                <DonateModal showDonateModal={showDonateModal} setShowDonateModal={setShowDonateModal} />
                <RankingHelpModal showRankingHelp={showRankingHelp} setShowRankingHelp={setShowRankingHelp} getRankInfo={getRankInfo} cardsLength={cards.length} />

            </div>
        </div>
    );
};

export default PokemonCardScanner;