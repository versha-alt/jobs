import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api.js';
import { toast } from '../toast.js';
import { EASE, Icon } from './ui.jsx';

export default function Settings({ countries, reload }) {
  const [name, setName] = useState('');

  const add = async (e) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    try {
      await api.countries.add(v);
      setName('');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (c) => {
    try {
      await api.countries.remove(c.id);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="section-head">
        <h2>Manage countries</h2>
        <span className="muted">{countries.length} available</span>
      </div>
      <motion.div layout className="card">
        <form className="country-add" onSubmit={add}>
          <input
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a country…"
          />
          <button type="submit" className="btn btn-primary btn-icon" aria-label="Add country">
            <Icon name="plus" />
          </button>
        </form>
        <div className="multi-select country-list">
          <AnimatePresence initial={false}>
            {countries.map((c) => (
              <motion.span
                key={c.id}
                layout
                className="chip"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15, ease: EASE }}
              >
                {c.name}
                <button
                  type="button"
                  className="chip-x"
                  onClick={() => remove(c)}
                  aria-label={`Remove ${c.name}`}
                >
                  <Icon name="x" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <p className="hint">
          The list is stored data, not hard-coded — every search screen reads from it. Removing a
          country only affects what is offered going forward; existing saved searches keep working.
        </p>
      </motion.div>
    </div>
  );
}
