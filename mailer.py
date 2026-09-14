import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import dns.resolver
import socket
import os

def send_direct_email(to_email, subject, html_content):
    sender = os.getenv("SMTP_USERNAME", "noreply@seame.click")
    
    # Opret email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f'"Din Plads-Agent" <{sender}>'
    msg["To"] = to_email
    part = MIMEText(html_content, "html")
    msg.attach(part)

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USERNAME")
    smtp_pass = os.getenv("SMTP_PASSWORD")

    try:
        if smtp_host:
            # Brug en rigtig SMTP server (f.eks. Proton Mail Bridge)
            print(f"Brug af SMTP server {smtp_host}:{smtp_port}...")
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
            server.ehlo()
            server.starttls()
            server.ehlo()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.sendmail(sender, to_email, msg.as_string())
            server.quit()
            return True
        else:
            # Fallback: Direct MX Delivery
            domain = to_email.split('@')[1]
            records = dns.resolver.resolve(domain, 'MX')
            mx_record = sorted(records, key=lambda x: x.preference)[0].exchange.to_text()
            
            server = smtplib.SMTP(mx_record, 25, timeout=10)
            server.ehlo(socket.getfqdn())
            try:
                server.starttls()
                server.ehlo()
            except smtplib.SMTPException:
                pass
            server.sendmail(sender, to_email, msg.as_string())
            server.quit()
            return True
    except Exception as e:
        print(f"Fejl ved afsendelse af email til {to_email}: {e}")
        return False

if __name__ == "__main__":
    # Test
    # print(send_direct_email("din@email.dk", "Test", "<p>Hej!</p>"))
    pass
