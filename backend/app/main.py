from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
import yfinance as yf
from app.database import engine
from app.database import get_db
import app.models as models

# Le dice a SQLAlchemy que agarre todos los modelos heredados de 'Base' y los cree en el motor (engine)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MarketLens API", version="0.1.0")

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
@app.get("/api/v1/mercado/historial/{ticker}")
def obtener_historial_precios(ticker: str, periodo: str = "1mo"):
    try:
        # 1. Nos conectamos con el activo en Yahoo Finance
        activo = yf.Ticker(ticker)
        
        # 2. Le pedimos el historial de precios. 
        # Esto nos devuelve un objeto llamado DataFrame (una tabla interna de Python)
        historial_df = activo.history(period=periodo)
        
        # Si la tabla que nos devuelve está vacía, es porque el ticker no existe o no hay datos
        if historial_df.empty:
            raise HTTPException(status_code=404, detail=f"No se encontró historial para el ticker: {ticker}")
        
        # 3. Procesamos la tabla para transformarla en una lista de diccionarios (JSON)
        lista_precios = []
        
        # Iteramos fila por fila sobre la tabla que nos mandó Yahoo Finance
        for fecha, fila in historial_df.iterrows():
            registro = {
                "fecha": fecha.strftime("%Y-%m-%d"), # Transformamos la fecha a texto legible
                "precio_apertura": round(fila["Open"], 2), # Redondeamos a 2 decimales
                "precio_maximo": round(fila["High"], 2),
                "precio_minimo": round(fila["Low"], 2),
                "precio_cierre": round(fila["Close"], 2),
                "volumen": int(fila["Volume"]) # El volumen siempre es un número entero
            }
            lista_precios.append(registro)
            
        # Devolvemos la lista ordenada cronológicamente
        return {
            "ticker": ticker.upper(),
            "periodo_consultado": periodo,
            "cantidad_registros": len(lista_precios),
            "datos": lista_precios
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener el historial: {str(e)}")
    
