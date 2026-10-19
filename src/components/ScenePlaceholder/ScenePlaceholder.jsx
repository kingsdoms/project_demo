// src/components/ScenePlaceholder/ScenePlaceholder.jsx
import styles from './ScenePlaceholder.module.css'

export default function ScenePlaceholder({ title, description, children }) {
  return (
    <div className={styles.root}>
      <h2 className={styles.title}>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  )
}