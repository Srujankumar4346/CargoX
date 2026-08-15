def send_sms(user_type: str, user_id: int, title: str, message: str):
    # Mock SMS Provider
    print(f"[SMS] To {user_type} {user_id}: {title} - {message}")
