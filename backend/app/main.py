from fastapi import FastAPI, HTTPException
import yfinance as yf

app = FastAPI(title="MarketLens API", version="0.1.0")

@app.get("/")
def read_root():
    return {"status": "MarketLens API funcionando correctamente"}

# Este va a ser nuestro primer endpoint de prueba para simular la tabla 'market_indicators'
@app.get("/api/v1/mercado/indicadores/{ticker}")
def obtener_indicadores_tiempo_real(ticker: str):
    try:
        # 1. Nos conectamos de forma virtual con Yahoo Finance para ese Ticker (ej: AAPL, GGAL)
        activo = yf.Ticker(ticker)
        
        # 2. Le pedimos la información general del activo (.info devuelve un diccionario de Python)
        info_completa = activo.info
        
        # Si Yahoo Finance no encuentra el activo, suele devolver un diccionario casi vacío o sin nombre
        if not info_completa or "longName" not in info_completa:
            raise HTTPException(status_code=404, detail=f"No se encontraron datos para el ticker: {ticker}")
        
        # 3. Filtramos solo los datos específicos que diseñamos en nuestro modelo lógico
        indicadores = {
            "ticker": ticker.upper(),
            "nombre": info_completa.get("longName"),
            "precio_actual": info_completa.get("currentPrice") or info_completa.get("regularMarketPrice"),
            "capitalizacion_mercado": info_completa.get("marketCap"),
            "relacion_pe": info_completa.get("trailingPE"), # Ratio P/E
            "variacion_porcentual_diaria": info_completa.get("regularMarketChangePercent"),
            "moneda": info_completa.get("currency")
        }
        
        return indicadores

    except Exception as e:
        # Si algo falla (un error de red, por ejemplo), FastAPI lo atrapa acá
        raise HTTPException(status_code=500, detail=f"Error al conectar con el proveedor: {str(e)}")
    
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