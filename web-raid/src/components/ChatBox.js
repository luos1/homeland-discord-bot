import React, { useState, useRef, useEffect } from 'react';
import './ChatBox.css';

function ChatBox({ messages, onSendMessage }) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="chat-box">
      <h3>실시간 채팅</h3>
      
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.type || 'user'}`}>
            {msg.type === 'system' ? (
              <div className="system-message">
                <span className="system-icon">⚠️</span>
                <span className="system-text">{msg.text}</span>
              </div>
            ) : (
              <div className="user-message">
                <span className="timestamp">{formatTimestamp(msg.timestamp)}</span>
                <span className="username">{msg.username}:</span>
                <span className="text">{msg.text}</span>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="메시지를 입력하세요..."
          maxLength={200}
        />
        <button type="submit">전송</button>
      </form>
    </div>
  );
}

export default ChatBox;
