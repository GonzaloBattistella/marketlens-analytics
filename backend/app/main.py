from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
import yfinance as yf
from app.database import engine
from app.database import get_db
import app.models as models
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

# Le dice a SQLAlchemy que agarre todos los modelos heredados de 'Base' y los cree en el motor (engine)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MarketLens API", version="0.1.0")

# Configuramos los permisos de CORS para que el frontend pueda consultar la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite que cualquier origen (como tu Live Server) se conecte
    allow_credentials=True,
    allow_methods=["*"], # Permite todos los métodos (GET, POST, etc.)
    allow_headers=["*"], # Permite todos los encabezados
)

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

@app.get("/db/indicadores")
def leer_indicadores_db(db: Session = Depends(get_db)):
    # Hacemos una consulta a la tabla market_indicators y traemos TODO (.all())
    activos = db.query(models.MarketIndicator).all()
    
    # Si la base de datos está completamente vacía, avisamos
    if not activos:
        return []
        
    return activos


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
            import yfinance as yf
            import pandas as pd
            
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