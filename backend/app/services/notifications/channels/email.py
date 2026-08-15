def send_email(user_type: str, user_id: int, title: str, message: str):
    # Mock Email Provider
    print(f"[EMAIL] To {user_type} {user_id}: {title} - {message}")
