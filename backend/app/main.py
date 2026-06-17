import requests
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
import yfinance as yf
from app.database import engine
from app.database import get_db
import app.models as models
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
from app.routers import auth
from app.routers import favorites


# Le dice a SQLAlchemy que agarre todos los modelos heredados de 'Base' y los cree en el motor (engine)
models.Base.metadata.create_all(bind=engine)

# Leo el archivo .env y cargo las variables en la memoria.
load_dotenv()

app = FastAPI(title="MarketLens API", version="0.1.0")

app.include_router(auth.router)
app.include_router(favorites.router)

# Configuramos los permisos de CORS para que el frontend pueda consultar la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",  # El puerto clásico de Live Server
        "http://localhost:5500"   # Por si las dudas mapea por localhost
    ],
    allow_credentials=True,
    allow_methods=["*"], # Permite todos los métodos (GET, POST, etc.)
    allow_headers=["*"], # Permite todos los encabezados
)

# Inicializamos el cliente de Gemini. Automaticamente va a buscar la variable 'GEMINI_API_KEY' en el entorno.
client = genai.Client()

@app.get("/")
def read_root():
    return {"status": "MarketLens API funcionando correctamente"}

# Este va a ser nuestro primer endpoint de prueba para simular la tabla 'market_indicators'
@app.get("/indicadores/{ticker}")
def obtener_indicadores(ticker: str, db: Session = Depends(get_db)): # Inyectamos la sesion de la DB.
    ticker = ticker.upper()
    asset = yf.Ticker(ticker)
    info = asset.info
    
    if not info or 'regularMarketPrice' not in info:
        raise HTTPException(status_code=404, detail=f"No se encontraron datos para el ticker {ticker}")
        
    # 1. Mapeamos los datos que nos mandó Yahoo Finance a variables limpias
    datos_api = {
        "ticker": ticker,
        "nombre": info.get('longName', 'Sin Nombre'),
        "precio_actual": info.get('regularMarketPrice'),
        "variacion_porcentual": info.get('regularMarketChangePercent'),
        "capitalizacion_mercado": info.get('marketCap'),
        "volumen": info.get('regularMarketVolume')
    }
    
    # 2. Buscamos en NUESTRA base de datos si ya existe este ticker
    indicador_db = db.query(models.MarketIndicator).filter(models.MarketIndicator.ticker == ticker).first()
    
    if indicador_db:
        # CASO A: El activo YA existe en la DB. Actualizamos sus valores dinámicos.
        indicador_db.precio_actual = datos_api["precio_actual"]
        indicador_db.variacion_porcentual = datos_api["variacion_porcentual"]
        indicador_db.capitalizacion_mercado = datos_api["capitalizacion_mercado"]
        indicador_db.volumen = datos_api["volumen"]
        print(f"🔄 ¡Actualizando datos de {ticker} en la base de datos!")
    else:
        # CASO B: El activo ES NUEVO. Creamos una instancia del modelo SQLAlchemy.
        nuevo_indicador = models.MarketIndicator(
            ticker=datos_api["ticker"],
            nombre=datos_api["nombre"],
            precio_actual=datos_api["precio_actual"],
            variacion_porcentual=datos_api["variacion_porcentual"],
            capitalizacion_mercado=datos_api["capitalizacion_mercado"],
            volumen=datos_api["volumen"]
        )
        # Le decimos a la sesión que se prepare para guardarlo
        db.add(nuevo_indicador)
        print(f"✨ ¡Guardando nuevo activo {ticker} en la base de datos!")
        
    # 3. IMPACTAMOS LOS CAMBIOS EN POSTGRESQL
    # SQLAlchemy hace un 'COMMIT' real. Si no llamamos a esto, los datos nunca se guardan físicamente.
    db.commit()
    
    # 4. Devolvemos la respuesta en formato JSON al cliente
    return datos_api

# Este endpoint va a simular los datos para la tabla 'price_history'
@app.get("/historial/{ticker}")
def obtener_historial_precios(ticker: str, db: Session = Depends(get_db)):
    ticker = ticker.upper()
    asset = yf.Ticker(ticker)
    
    # Traemos el historial de 1 mes (pueden ser unos 20-22 días hábiles de mercado)
    hist = asset.history(period="1mo")

    # Borro cualquier fila donde el precio de cierre sea NaN. Para que no rompa la logica del grafico.
    hist = hist.dropna(subset=['Close'])
    
    if hist.empty:
        raise HTTPException(status_code=404, detail=f"No se encontró historial para el ticker {ticker}")
    
    # 1. LIMPIEZA DE SEGURIDAD: Borramos el historial viejo que tengamos de ESTE ticker en la DB
    # Así evitamos duplicar filas si el usuario consulta el mismo ticker varias veces.
    db.query(models.PriceHistory).filter(models.PriceHistory.ticker == ticker).delete()
    
    # 2. Preparamos una lista vacía para acumular todas las filas del mes
    nuevas_filas = []
    
    # 3. Recorremos el DataFrame de yfinance fila por fila
    for index, row in hist.iterrows():
        # index es la fecha que nos da yfinance (a veces viene con zona horaria, por eso usamos .date())
        fecha_limpia = index.date()
        
        # Creamos el objeto del modelo para cada día
        registro_dia = models.PriceHistory(
            ticker=ticker,
            fecha=fecha_limpia,
            precio_apertura=float(row['Open']),
            precio_maximo=float(row['High']),
            precio_minimo=float(row['Low']),
            precio_cierre=float(row['Close']),
            volumen=int(row['Volume'])
        )
        nuevas_filas.append(registro_dia)
    
    # 4. BULK INSERT: Agregamos toda la lista de filas de un solo viaje a la sesión
    db.add_all(nuevas_filas)
    
    # 5. Impactamos de verdad en PostgreSQL
    db.commit()
    print(f"📈 ¡Se guardaron {len(nuevas_filas)} días de historial para {ticker} en la base de datos!")
    
    # 6. Formateamos la respuesta JSON que le vuelve al usuario para mantener la estructura de antes
    respuesta = []
    for fila in nuevas_filas:
        respuesta.append({
            "fecha": fila.fecha.strftime("%Y-%m-%d"),
            "apertura": fila.precio_apertura,
            "maximo": fila.precio_maximo,
            "minimo": fila.precio_minimo,
            "cierre": fila.precio_cierre,
            "volumen": fila.volumen
        })
        
    return respuesta


# ----------------------------------------------------------------
#          ENDPOINTS DE LECTURA DIRECTA DESDE LA DB
# ----------------------------------------------------------------

# Indicadores DB
@app.get("/db/indicadores")
def leer_indicadores_db(db: Session = Depends(get_db)):
    # Hacemos una consulta a la tabla market_indicators y traemos TODO (.all())
    activos = db.query(models.MarketIndicator).all()
    
    # Si la base de datos está completamente vacía, avisamos
    if not activos:
        return []
        
    return activos


# Historial DB
@app.get("/db/historial/{ticker}")
def leer_historial_db(ticker: str, db: Session = Depends(get_db)):
    ticker = ticker.upper()
    
    # Intentamos buscar en la base de datos primero
    historial = db.query(models.PriceHistory)\
                  .filter(models.PriceHistory.ticker == ticker)\
                  .order_by(models.PriceHistory.fecha.asc())\
                  .all()
                  
    # Si NO hay datos en la DB, los vamos a buscar a internet automáticamente
    if not historial:
        print(f"🚀 {ticker} no está en la DB. Descargando historial de Yahoo Finance...")
        try:
            # Buscamos el historial en yfinance
            stock = yf.Ticker(ticker)
            df = stock.history(period="30d")
            
            if df.empty:
                raise HTTPException(status_code=404, detail=f"No se encontraron datos en Yahoo para {ticker}")
                
            # Formateamos y guardamos en lote igual que hacías en la otra ruta
            nuevas_filas = []
            for indice, fila in df.iterrows():
                nueva_fecha = indice.date()
                nuevo_registro = models.PriceHistory(
                    ticker=ticker,
                    fecha=nueva_fecha,
                    precio_apertura=float(fila['Open']),
                    precio_maximo=float(fila['High']),
                    precio_minimo=float(fila['Low']),
                    precio_cierre=float(fila['Close']),
                    volumen=int(fila['Volume'])
                )
                nuevas_filas.append(nuevo_registro)
            
            # Guardamos en Postgres
            db.bulk_save_objects(nuevas_filas)
            db.commit()
            
            # Volvemos a consultar la DB ahora que ya tiene los datos guardados
            historial = db.query(models.PriceHistory)\
                          .filter(models.PriceHistory.ticker == ticker)\
                          .order_by(models.PriceHistory.fecha.asc())\
                          .all()
                          
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Error al automatizar el historial: {str(e)}")
        
    return historial

# Refrescar - Actualizar indicadores e historial DB.
@app.post("/db/refrescar")
def refrescar_todos_los_indicadores_e_historiales(db: Session = Depends(get_db)):
    try:
        import yfinance as yf
        
        activos_guardados = db.query(models.MarketIndicator).all()
        
        if not activos_guardados:
            return {"message": "No hay activos en la DB para actualizar."}
            
        print(f"🔄 Refrescando indicadores e historiales de {len(activos_guardados)} activos...")
        
        for activo in activos_guardados:
            stock = yf.Ticker(activo.ticker)
            
            # --- 1. ACTUALIZAR CUADRO DE INDICADORES ---
            datos_hoy = stock.history(period="1d")
            if not datos_hoy.empty:
                info_reciente = datos_hoy.iloc[0]
                precio_actual = float(info_reciente['Close'])
                precio_apertura = float(info_reciente['Open'])
                activo.precio_actual = precio_actual
                activo.variacion_porcentual = ((precio_actual - precio_apertura) / precio_apertura) * 100

            # --- 2. ACTUALIZAR HISTORIAL (Evitamos datos viejos) ---
            # Borramos el historial viejo de este activo en Postgres
            db.query(models.PriceHistory).filter(models.PriceHistory.ticker == activo.ticker).delete()
            
            # Descargamos los 30 días más recientes de internet
            df_historial = stock.history(period="30d")
            nuevas_filas = []
            for indice, fila in df_historial.iterrows():
                nuevo_registro = models.PriceHistory(
                    ticker=activo.ticker,
                    fecha=indice.date(),
                    precio_apertura=float(fila['Open']),
                    precio_maximo=float(fila['High']),
                    precio_minimo=float(fila['Low']),
                    precio_cierre=float(fila['Close']),
                    volumen=int(fila['Volume'])
                )
                nuevas_filas.append(nuevo_registro)
            
            # Guardamos el bloque nuevo en Postgres utilizando bulk_save.
            db.bulk_save_objects(nuevas_filas)
        
        # Guardamos todo de un solo viaje
        db.commit()
        return {"status": "success", "message": "Indicadores e historiales actualizados correctamente."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al refrescar la DB: {str(e)}")
    

# Eliminar Activo
@app.delete("/db/indicadores/{ticker}")
def eliminar_indicador(ticker: str, db: Session = Depends(get_db)):
    try:
        # Pasamos el ticker a mayusuculas, para evitar problemas de tipeo.
        ticker_upper = ticker.upper()

        activo = db.query(models.MarketIndicator).filter(models.MarketIndicator.ticker == ticker_upper).first()

        if not activo: 
            # si no existe, arrojamos un eror 404.
            raise HTTPException(status_code=404, detail=f"El activo {ticker_upper} no existe en la base de datos.")
        
        # Borramos todo el historial de ese ticker.
        db.query(models.PriceHistory).filter(models.PriceHistory.ticker == ticker_upper).delete()

        # Borramos el activo.
        db.delete(activo)

        # Guardamos los datos en la base de datos.
        db.commit()

        return {"status": "success", "message": f"Activo {ticker_upper} e historial eliminados correctamente."}

    except Exception as e:
        db.rollback() # Limpio la session por si algo falla.
        raise HTTPException(status_code=500, detail=f"Error al eliminar el activo: {str(e)}")


# Llave privada, para conectarme al proveedor de noticias.
NEWS_API_TOKEN = "df9f84d90eb746ba9d036abcab79c85a" # API-KEY NewsAPI.org

@app.get('/api/noticias/{ticker}')
def obtener_noticias_activo(ticker: str):
    """
    Endpoint que recibe un Ticker (ej: AAPL, BTC), sale a internet, 
    busca noticias financieras relevantes y te las devuelve limpias en un JSON.
    """

    ticker_upper = ticker.upper()

    # AUTOMATIZACIÓN INTELIGENTE:
    # Separamos si es una de tus criptos conocidas o una acción tradicional
    if ticker_upper in ["BTC", "ETH", "USDT"]:
        mapeo_cripto = {"BTC": "Bitcoin", "ETH": "Ethereum", "USDT": "Tether"}
        termino_busqueda = f"{mapeo_cripto[ticker_upper]} OR {ticker_upper}"
    else:
        # Para cualquier acción (AAPL, GGAL, TSLA, MSFT, etc.) armamos una 
        # compuerta lógica. NewsAPI buscará el ticker pero filtrará para que 
        # sí o sí la noticia hable de finanzas, bolsa o mercado.
        termino_busqueda = f"{ticker_upper} AND (bolsa OR acciones OR stock OR finanzas)"

    # Preparamos la URL externa y los parametros de filtrado para TheNewsAPI.
    url = "https://newsapi.org/v2/everything"

    dominos_bloqueados = "engadget.com,buzzfeed.com"

    parametros = {
        "q": termino_busqueda,
        "language": "en",       # Traemos contenido tanto en español como en inglés
        "sort_by": "publishedAt",
        "pageSize": 8,
        "excludeDomains": dominos_bloqueados,
        "apiKey": NEWS_API_TOKEN
    }

    try: 
        respuesta = requests.get(url, params=parametros, timeout=5)
        if respuesta.status_code != 200:
            raise HTTPException(status_code=500, detail="Error en el proveedor de noticias.")
            
        data = respuesta.json()
        articulos = data.get("articles", [])
        
        noticias_limpias = []
        for art in articulos:
            titulo = art.get("title")
            url_noticia = art.get("url", "").lower() # Capturamos la URL en minusculas.

            # Si el tiutlo está vacio o es una nota borrada.
            if not titulo or "[Removed]" in titulo or "consent" in url_noticia:
                continue

            noticias_limpias.append({
                "title": titulo,
                "description": art.get("description") or "Check the financial updates and market movements for this asset in the full report.",
                "url": art.get("url"),
                "image_url": art.get("urlToImage"),
                "published_at": art.get("publishedAt"),
                "source": art.get("source", {}).get("name") or "Finance News"
            })


        # Evaluamos si nos quedaron de verdad noticias útiles en la lista
        # Si la lista está vacía, forzamos el Plan B de Wall Street
        if len(noticias_limpias) == 0:
            print(f"⚠️ Cero noticias limpias para {ticker_upper}. Ejecutando Plan B general de mercados...")
            
            parametros_fallback = {
                "q": "stock market",  # Un término masivo que jamás viene vacío
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": 4,
                "apiKey": NEWS_API_TOKEN
            }
            
            respuesta_fallback = requests.get(url, params=parametros_fallback, timeout=5)
            data_fallback = respuesta_fallback.json()
            
            for art in data_fallback.get("articles", []):
                titulo = art.get("title")
                url_noticia = art.get("url", "").lower()
                
                if not titulo or "[Removed]" in titulo or "consent" in url_noticia:
                    continue
                    
                noticias_limpias.append({
                    "title": titulo,
                    "description": art.get("description") or "Check the latest market movements and global updates in the full report.",
                    "url": art.get("url"),
                    "image_url": art.get("urlToImage"),
                    "published_at": art.get("publishedAt"),
                    "source": art.get("source", {}).get("name") or "Wall Street"
                })

        # Retornamos las primeras 4.
        return noticias_limpias[:4]
    
    except requests.exceptions.RequestException as e:
        # Por si el servidor de noticias está caido o no tenemos internet.
        print(f'Error de conexión: {e}')
        raise HTTPException(status_code=500, detail="El servicio de noticias, no se encuentra disponible temporalmente.")
    

# Generar reporte de un activo con Gemini 2.5 Pro.
@app.get("/api/analisis/{ticker}")
async def generar_analisis_ia(ticker: str, db: Session = Depends(get_db)):
    """
    Endpoint que contacta a Gemini 1.5 Pro para generar un reporte financiero
    profesional, estructurado y realista de un activo.
    """
    try: 
        ticker_upper = ticker.upper() # Convierto el ticker a mayusculas por seguridad.

        # El backend busca los precios en la base de datos o API.
        historial_completo = leer_historial_db(ticker_upper, db)


        # soluciono el problema, si no hay datos en la base de datos para el historial.
        if not historial_completo:
            raise HTTPException(status_code=500, detail=f"No se encontraron datos historicos.")

        # Detalle de los ultimos 30 diás para las funciones del gráfico.
        historial_reciente = historial_completo[-30:]
        
        datos_corto_plazo = [
            {
                "fecha": str(p.fecha),
                "apertura": p.precio_apertura,
                "cierre": p.precio_cierre,
                "maximo": p.precio_maximo,
                "minimo": p.precio_minimo
            }
            for p in historial_reciente
        ]

        # Procesamos la tendencia estructural de los últimos 200 dias. 
        historial_largo = historial_completo[-200:]
        precios_cierre_200 = [p.precio_cierre for p in historial_largo] # Lista con los precios de cierre, de los ultimos 200 días.

        precio_actual = precios_cierre_200[-1]
        maximo_200 = max(precios_cierre_200)
        minimo_200 = min(precios_cierre_200)
        media_movil_200 = sum(precios_cierre_200) / len(precios_cierre_200)
        tendencia_200 = "ALCISTA" if precio_actual > media_movil_200 else "BAJISTA"


        # Busco las noticias en la DB. Reutilizo funcion del backend que obtiene las noticias de una API.
        noticias_data = obtener_noticias_activo(ticker_upper)

        # Le doy el rol y la estructura exacta que queremos al reporte.
        prompt_sistema = (
            "Actuá como un Analista Financiero Senior y Gestor de Portafolios experto. "
            "Tu tarea es confeccionar un reporte de análisis técnico y fundamental de mercado "
            "reducido, sobrio, profesional y basado en expectativas realistas.\n\n"
            "Estructurá tu respuesta estrictamente con los siguientes títulos en formato Markdown:\n"
            f"### 📊 Análisis de Situación Actual: {ticker_upper}\n"
            "(Breve resumen de qué es el activo y su contexto de mercado actual).\n\n"
            "### ⏱️ Perspectiva a Corto Plazo (Días/Semanas)\n"
            "(Factores técnicos, volatilidad esperada y catalizadores inmediatos).\n\n"
            "### 🏛️ Perspectiva a Mediano/Largo Plazo (Meses/Años)\n"
            "(Fundamentos sólidos, contexto macroeconómico y potencial de crecimiento o riesgos estructurales).\n\n"
            "### ⚠️ Riesgos Clave a Monitorear\n"
            "(Al menos 2 o 3 riesgos específicos que podrían invalidar las perspectivas positivas).\n\n"
            "Usa un tono analítico, formal, sin rodeos y adaptado al público inversor. No uses introducciones genéricas ni saludos."
        )

        # Paquete de Datos para la IA
        prompt_con_datos = (
            f"Generá el reporte financiero para el activo: {ticker_upper}.\n\n"
            f"--- DATOS DE CORTO PLAZO (Últimos 30 días) ---\n"
            f"{datos_corto_plazo}\n\n"
            f"--- MÉTRICAS ESTRUCTURALES DE LARGO PLAZO (Últimos {len(precios_cierre_200)} días) ---\n"
            f"- Precio de Cierre Actual: {precio_actual}\n"
            f"- Máximo del período: {maximo_200}\n"
            f"- Mínimo del período: {minimo_200}\n"
            f"- Media Móvil Simple (SMA 200): {round(media_movil_200, 2)}\n"
            f"- Tendencia de Fondo: {tendencia_200}\n\n"
            f"--- NOTICIAS RECIENTES DEL ACTIVO ---\n"
            f"{noticias_data}"
        )

        # LLamada a Gemini 2.5 Flash.
        respuesta = client.models.generate_content(
            model = 'gemini-2.5-flash',
            contents=prompt_con_datos,
            config=types.GenerateContentConfig(
                system_instruction=prompt_sistema,
                temperature=0.3, # Temperatura baja, para que sea más analitico, preciso y no invente cosas.
            )
        )

        # Validamos que la IA, haya retornado una respuesta.
        if not respuesta.text:
            raise HTTPException(status_code=500, detail="La IA no pudo procesar el reporte.")
        
        # Devolvemos el reporte al frontend estructurado en JSON.
        return {
            "ticker": ticker_upper,
            "reporte": respuesta.text
        }

    except Exception as e:
        print(f"❌ Error en el endpoint de IA: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno al generar el análisis: {str(e)}")
    

# ENDPOINT PARA REALIZAR UN "HEALTH CHECK".
@app.get("/health", tags=["Monitoreo"])
def check_health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "online", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error de conexión con la base de datos.")