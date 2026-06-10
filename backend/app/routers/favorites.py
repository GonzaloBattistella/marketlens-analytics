from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.security import get_current_user

router = APIRouter(prefix="/favorites", tags=["Favoritos"])

@router.post("/add", status_code=status.HTTP_201_CREATED)
def add_favorite(
    ticker: str,
    db : Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Agrega un ticker a los favoritos del usuario autenticado.
    """

    ticker = ticker.upper().strip()

    # Verifico si el usuario, ya tiene ese activo en favoritos.
    ya_existe = db.query(models.UserFavorite).filter(models.UserFavorite.usuario_id == current_user.id, models.UserFavorite.ticker == ticker).first()

    if ya_existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El activo {ticker} ya está en tus favoritos."
        )
    
    # Creo el registro vincunlando el ticker con el ID del usuario actual
    nuevo_favorito = models.UserFavorite(
        ticker=ticker,
        usuario_id=current_user.id    
    )

    db.add(nuevo_favorito)
    db.commit()

    return {"status": "success", "message": f"Activo {ticker} agregado a favoritos."}


# Endpoint para obtener todos los favoritos del Usuario.
@router.get("", response_model=list[str])
def get_user_favorites(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Devuelve la lista de strings con todos los tickers favoritos del usuario logueado.
    """
    # Busco en la tabla todos los favoritos que pertenecen al ID del usuario actual.
    favoritos_db = db.query(models.UserFavorite).filter(models.UserFavorite.usuario_id == current_user.id).all()

    # Extraigo solo el texto del ticker.
    lista_tickers = [fav.ticker for fav in favoritos_db]

    return lista_tickers


# Endpoint para eliminar un activo de los favoritos.
@router.delete("/remove")
def remove_favorite(
    ticker: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Elimina un ticker especifico de los favoritos del usuario autenticado.
    """

    ticker = ticker.upper().strip()

    # Buscamos si ese registro exacto existe para este usuario.
    favorito = db.query(models.UserFavorite).filter(models.UserFavorite.usuario_id == current_user.id, models.UserFavorite.ticker == ticker).first()

    # Si no existe, tiramos un error 404 (No Encontrado).
    if not favorito:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El activo {ticker} no se encuentra en tus favoritos."
        )
    
    # Si existe, lo borramos de Postgres.
    db.delete(favorito)
    db.commit()

    return {"status": "success", "message": f"Activo {ticker} eliminado de tus favoritos."}